/**
 * Batch service — управление партиями варки
 * Логика: start → active stages (mash/hops/chill) → fermenting → conditioning → ready
 */

import { prisma } from '../db/client.js'
import { getRedis, KEYS } from '../lib/redis.js'
import {
  calcOG, calcFG, calcABV, calcIBU, calcSRM,
  calcStyleMatch, calcProcessAccuracy, calcBalanceScore,
  calcQuality, calcSellPrice, calcBrewXP,
  type MaltInput, type HopInput, type ProcessAccuracy, type StyleRange,
} from '../game/calculations.js'

// ── Длительности этапов (секунды) ────────────────────────────────────────────
// В реальной игре зависят от оборудования; здесь — базовые значения
const STAGE_DURATION = {
  mashing:      60 * 5,    // 5 мин — активная мини-игра
  boiling:      60 * 5,    // 5 мин — активная мини-игра
  fermenting:   60 * 60 * 4,  // 4 часа — фоновый таймер
  conditioning: 60 * 60 * 2,  // 2 часа — фоновый таймер
} as const

// ── Типы ──────────────────────────────────────────────────────────────────────

export interface RecipePayload {
  name:          string
  targetStyleKey?: string
  malts: Array<{ key: string; amountKg: number }>
  hops:  Array<{ key: string; amountG: number; timing: string }>
  yeastKey:      string
  waterKey:      string
  mashTempC:     number
  fermentTempC:  number
  volumeL:       number
}

export interface StageAccuracy {
  mash:    number   // 0–1
  hops:    number   // 0–1
  chill:   number   // 0–1
  ferment?: number  // 0–1, может прийти позже
}

export class BatchError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'BatchError'
  }
}

// ── Вспомогательные ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeBatch(b: any) {
  return {
    id:         b.id.toString(),
    breweryId:  b.brewery_id.toString(),
    recipeId:   b.recipe_id?.toString() ?? null,
    styleId:    b.style_id?.toString() ?? null,
    volumeL:    Number(b.volume_l),
    status:     b.status,
    startedAt:  b.started_at,
    readyAt:    b.ready_at,
    og:         b.og != null ? Number(b.og) : null,
    fg:         b.fg != null ? Number(b.fg) : null,
    abv:        b.abv != null ? Number(b.abv) : null,
    ibu:        b.ibu,
    srm:        b.srm != null ? Number(b.srm) : null,
    styleMatch: b.style_match,
    quality:    b.quality,
    profile:    b.profile,
    accuracy:   b.accuracy,
    // вычисляем оставшееся время на лету
    secondsLeft: b.ready_at
      ? Math.max(0, Math.round((new Date(b.ready_at).getTime() - Date.now()) / 1000))
      : null,
  }
}

async function resolveIngredients(malts: RecipePayload['malts'], hops: RecipePayload['hops']) {
  const maltKeys = malts.map((m) => m.key)
  const hopKeys  = hops.map((h) => h.key)
  const allKeys  = [...new Set([...maltKeys, ...hopKeys])]

  const ingredients = await prisma.ingredient.findMany({
    where: { key: { in: allKeys } },
  })
  const byKey = Object.fromEntries(ingredients.map((i: any) => [i.key, i]))
  return byKey
}

// ── POST /batches/start ───────────────────────────────────────────────────────

export async function startBatch(
  userId: bigint,
  breweryId: bigint,
  payload: RecipePayload,
) {
  const { malts, hops, yeastKey, waterKey, mashTempC, fermentTempC, volumeL, targetStyleKey } = payload

  // Валидация
  if (malts.length === 0) throw new BatchError('Засыпь не может быть пустой', 'EMPTY_MALTS')
  if (hops.length === 0)  throw new BatchError('Хмелевая программа не может быть пустой', 'EMPTY_HOPS')
  if (volumeL <= 0 || volumeL > 500) throw new BatchError('Некорректный объём партии', 'INVALID_VOLUME')

  // Резолвим ингредиенты из БД
  const ingredientMap = await resolveIngredients(malts, hops)

  // Проверяем что все ключи существуют
  for (const m of malts) {
    if (!ingredientMap[m.key]) throw new BatchError(`Солод не найден: ${m.key}`, 'INGREDIENT_NOT_FOUND')
  }
  for (const h of hops) {
    if (!ingredientMap[h.key]) throw new BatchError(`Хмель не найден: ${h.key}`, 'INGREDIENT_NOT_FOUND')
  }

  // Проверяем наличие ингредиентов на складе
  const inventoryItems = await prisma.inventory.findMany({
    where: {
      brewery_id: breweryId,
      ingredient: { key: { in: [...malts.map((m) => m.key), ...hops.map((h) => h.key)] } },
    },
    include: { ingredient: { select: { key: true } } },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stockByKey: Record<string, number> = Object.fromEntries(
    inventoryItems.map((i: any) => [i.ingredient.key, Number(i.quantity)]),
  )

  // Хмель — граммы, ингредиент хранится в 100г или кг
  // Пока упрощённо: проверяем что хоть что-то есть
  for (const m of malts) {
    const stock = stockByKey[m.key] ?? 0
    if (stock < m.amountKg) {
      throw new BatchError(
        `Недостаточно ${m.key} на складе: нужно ${m.amountKg} кг, есть ${stock} кг`,
        'INSUFFICIENT_STOCK',
      )
    }
  }

  // Ищем стиль
  const beerStyle = targetStyleKey
    ? await prisma.beerStyle.findUnique({ where: { key: targetStyleKey } })
    : null

  // Ищем/создаём рецепт
  const yeastIng = await prisma.ingredient.findUnique({ where: { key: yeastKey } })
  const waterIng = await prisma.ingredient.findUnique({ where: { key: waterKey } })

  // Транзакция: списать ингредиенты + создать партию
  const batch = await prisma.$transaction(async (tx: any) => {
    // Списываем солод со склада
    for (const m of malts) {
      const ing = ingredientMap[m.key]
      await tx.inventory.update({
        where: { brewery_id_ingredient_id: { brewery_id: breweryId, ingredient_id: ing.id } },
        data: { quantity: { decrement: m.amountKg } },
      })
    }

    // Создаём/находим рецепт (snapshot рецепта)
    const recipe = await tx.recipe.create({
      data: {
        author_id:       userId,
        name:            payload.name,
        target_style_id: beerStyle?.id ?? null,
        malt_bill:       malts,
        hop_schedule:    hops,
        yeast_key:       yeastIng?.key ?? yeastKey,
        water_key:       waterIng?.key ?? waterKey,
        process:         { mash_temp_c: mashTempC, ferment_temp_c: fermentTempC, volume_l: volumeL },
      },
    })

    const now     = new Date()
    const readyAt = new Date(now.getTime() + STAGE_DURATION.mashing * 1000)

    // Создаём партию в статусе mashing
    const newBatch = await tx.batch.create({
      data: {
        brewery_id: breweryId,
        recipe_id:  recipe.id,
        style_id:   beerStyle?.id ?? null,
        volume_l:   volumeL,
        status:     'mashing',
        started_at: now,
        ready_at:   readyAt,
        profile:    {},
        accuracy:   {},
      },
    })

    return newBatch
  })

  // Пишем в Redis маркер с TTL = полная длительность (mashing + boiling + fermenting + conditioning)
  // Воркер использует его как hint, основной источник — ready_at в БД
  const totalSeconds =
    STAGE_DURATION.mashing + STAGE_DURATION.boiling +
    STAGE_DURATION.fermenting + STAGE_DURATION.conditioning
  try {
    await getRedis().set(
      KEYS.batchReady(batch.id.toString()),
      JSON.stringify({ batchId: batch.id.toString(), breweryId: breweryId.toString() }),
      'EX', totalSeconds + 60, // +60с запас
    )
  } catch {
    // Redis недоступен — не блокируем, воркер работает по БД
  }

  return serializeBatch(batch)
}

// ── POST /batches/:id/complete-stage ─────────────────────────────────────────

export async function completeStage(
  batchId: bigint,
  breweryId: bigint,
  accuracy: StageAccuracy,
) {
  // Клamp точности 0–1
  const clampAcc = (v: number) => Math.min(1, Math.max(0, v))
  const safeAcc: ProcessAccuracy = {
    mash:    clampAcc(accuracy.mash),
    hops:    clampAcc(accuracy.hops),
    chill:   clampAcc(accuracy.chill),
    ferment: clampAcc(accuracy.ferment ?? 0.85), // дефолт при авто-завершении
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { recipe: true, style: true },
  }) as any

  if (!batch)                         throw new BatchError('Партия не найдена', 'NOT_FOUND')
  if (batch.brewery_id !== breweryId) throw new BatchError('Нет доступа к партии', 'FORBIDDEN')

  // Разрешённые переходы
  const transitions: Record<string, string> = {
    mashing:  'boiling',
    boiling:  'fermenting',
    // chill — часть boiling этапа (клиент присылает все три за раз)
  }

  if (!['mashing', 'boiling'].includes(batch.status)) {
    throw new BatchError(
      `Нельзя завершить этап в статусе ${batch.status}`,
      'INVALID_STATUS',
    )
  }

  const now      = new Date()
  const nextStatus = batch.status === 'mashing' ? 'boiling' : 'fermenting'

  // При переходе в fermenting — считаем финальные параметры
  let updateData: Record<string, unknown> = {
    status:   nextStatus,
    ready_at: new Date(now.getTime() + STAGE_DURATION[nextStatus as keyof typeof STAGE_DURATION] * 1000),
    accuracy: safeAcc,
  }

  if (nextStatus === 'fermenting') {
    // Все активные этапы пройдены — считаем параметры пива
    const recipe = batch.recipe
    const maltBill    = recipe.malt_bill as Array<{ key: string; amountKg: number }>
    const hopSchedule = recipe.hop_schedule as Array<{ key: string; amountG: number; timing: string }>
    const process     = recipe.process as { mash_temp_c: number; ferment_temp_c: number; volume_l: number }

    // Резолвим параметры ингредиентов из БД
    const ingKeys = [...new Set([
      ...maltBill.map((m) => m.key),
      ...hopSchedule.map((h) => h.key),
      recipe.yeast_key,
    ].filter(Boolean))]

    const ingredients = await prisma.ingredient.findMany({ where: { key: { in: ingKeys } } }) as any[]
    const byKey = Object.fromEntries(ingredients.map((i: any) => [i.key, i]))

    const maltInputs: MaltInput[] = maltBill.map((m) => ({
      ppkg:     (byKey[m.key]?.params as any)?.ppkg ?? 300,
      colorL:   (byKey[m.key]?.params as any)?.color_l ?? 2,
      amountKg: m.amountKg,
    }))

    const hopInputs: HopInput[] = hopSchedule.map((h) => ({
      alphaFraction: (byKey[h.key]?.params as any)?.alpha ?? 0.08,
      amountG:       h.amountG,
      timing:        h.timing as any,
    }))

    const yeastData = byKey[recipe.yeast_key]
    const attenuation = (yeastData?.params as any)?.attenuation ?? 0.75
    const volumeL     = process.volume_l ?? Number(batch.volume_l)
    const mashTempC   = process.mash_temp_c ?? 66

    // Профиль воды совпадает со стилем?
    const waterProfile = byKey[recipe.water_key]
    const styleBestFor: string[] = (waterProfile?.params as any)?.best_for ?? []
    const bonusWater = batch.style != null && styleBestFor.some(
      (s: string) => batch.style.key?.includes(s) || s.includes(batch.style.key ?? ''),
    )

    // Строим StyleRange из стиля
    const styleRange: StyleRange | undefined = batch.style
      ? {
          og:         batch.style.og_min != null ? [Number(batch.style.og_min), Number(batch.style.og_max)] : undefined,
          fg:         batch.style.fg_min != null ? [Number(batch.style.fg_min), Number(batch.style.fg_max)] : undefined,
          abv:        batch.style.abv_min != null ? [Number(batch.style.abv_min), Number(batch.style.abv_max)] : undefined,
          ibu:        batch.style.ibu_min != null ? [batch.style.ibu_min, batch.style.ibu_max] : undefined,
          srm:        batch.style.srm_min != null ? [Number(batch.style.srm_min), Number(batch.style.srm_max)] : undefined,
          buguTarget: batch.style.bugu_min != null ? [Number(batch.style.bugu_min), Number(batch.style.bugu_max)] : undefined,
          basePrice:  batch.style.base_price,
        }
      : undefined

    // Считаем параметры
    const { og, gp } = calcOG(maltInputs, volumeL)
    const fg          = calcFG(og, attenuation, mashTempC, safeAcc.mash)
    const abv         = calcABV(og, fg)
    const ibu         = calcIBU(hopInputs, og, volumeL, safeAcc.hops)
    const srm         = calcSRM(maltInputs, volumeL)
    const styleMatch  = styleRange ? calcStyleMatch({ og, fg, abv, ibu, srm }, styleRange) : 0
    const { processAccuracy, penaltyOffflavor } = calcProcessAccuracy(safeAcc)
    const balanceScore = calcBalanceScore(ibu, gp, styleRange?.buguTarget)
    const quality     = calcQuality({
      styleMatch, processAccuracy, balanceScore,
      penaltyOffflavor, bonusWater,
    })

    updateData = {
      ...updateData,
      og:          og.toFixed(3),
      fg:          fg.toFixed(3),
      abv:         abv.toFixed(2),
      ibu:         Math.round(ibu),
      srm:         srm.toFixed(1),
      style_match: styleMatch,
      quality,
      profile:     { gp, bugu: gp > 0 ? Math.round((ibu / gp) * 100) / 100 : 0 },
      accuracy:    safeAcc,
      // После брожения → conditioning
      ready_at:    new Date(now.getTime() + STAGE_DURATION.fermenting * 1000),
    }

    // Начисляем XP игроку
    const user = await prisma.user.findUnique({
      where: { brewery: { id: breweryId } },
      select: { id: true, xp: true, level: true },
    }) as any

    if (user) {
      const xpGain = calcBrewXP(quality, volumeL, false)
      await prisma.user.update({
        where: { id: user.id },
        data: { xp: { increment: xpGain } },
      })
    }
  }

  const updated = await prisma.batch.update({
    where: { id: batchId },
    data:  updateData,
  })

  return serializeBatch(updated)
}

// ── GET /batches ─────────────────────────────────────────────────────────────

export async function getBatches(breweryId: bigint) {
  // Автоматически продвигаем готовые таймеры перед отдачей
  const now = new Date()

  // fermenting → conditioning
  await prisma.batch.updateMany({
    where: {
      brewery_id: breweryId,
      status:     'fermenting',
      ready_at:   { lte: now },
    },
    data: {
      status:   'conditioning',
      ready_at: new Date(now.getTime() + STAGE_DURATION.conditioning * 1000),
    },
  })

  // conditioning → ready
  await prisma.batch.updateMany({
    where: {
      brewery_id: breweryId,
      status:     'conditioning',
      ready_at:   { lte: now },
    },
    data: {
      status:   'ready',
      ready_at: null,
    },
  })

  const batches = await prisma.batch.findMany({
    where:   { brewery_id: breweryId, status: { not: 'sold' } },
    orderBy: { started_at: 'desc' },
    include: { style: { select: { key: true, name: true } } },
  }) as any[]

  return batches.map((b: any) => ({
    ...serializeBatch(b),
    styleName: b.style?.name ?? null,
    styleKey:  b.style?.key ?? null,
  }))
}
