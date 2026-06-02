/**
 * Market service — заказы NPC и продажа партий
 *
 * Генерация заказов: раз в ORDER_GEN_INTERVAL_H часов на пивоварню,
 * максимум MAX_ACTIVE_ORDERS активных.
 * Продажа: расчёт цены по B.11 + начисление валюты/репутации.
 */

import { prisma } from '../db/client.js'
import { calcSellPrice } from '../game/calculations.js'
import { GAME_CONFIG } from '../config/game-config.js'

// ── Конфигурация ──────────────────────────────────────────────────────────────

const ORDER_GEN_INTERVAL_H = 4   // новые заказы каждые 4 часа
const MAX_ACTIVE_ORDERS    = 5   // макс. активных заказов у пивоварни
const ORDER_TTL_H          = 48  // заказ живёт 48 часов

// Стили заказов NPC — пары [styleKey, customerName, minQuality]
const NPC_ORDER_TEMPLATES: Array<{
  styleKey:    string
  customerName: string
  minQuality:  number
  rewardSoft:  number
  rewardRep:   number
  constraints: Record<string, unknown>
}> = [
  { styleKey: 'pale_ale',  customerName: 'Паб «Хмель»',        minQuality: 60, rewardSoft: 180, rewardRep: 3, constraints: { min_quality: 60 } },
  { styleKey: 'ipa',       customerName: 'Бар «Солод»',         minQuality: 70, rewardSoft: 260, rewardRep: 5, constraints: { min_quality: 70, ibu: [40, 70] } },
  { styleKey: 'stout',     customerName: 'Ресторан «Дубовая»',  minQuality: 65, rewardSoft: 220, rewardRep: 4, constraints: { min_quality: 65 } },
  { styleKey: 'hefeweizen',customerName: 'Кафе «Пшеничное»',   minQuality: 55, rewardSoft: 160, rewardRep: 2, constraints: { min_quality: 55 } },
  { styleKey: 'porter',    customerName: 'Клуб «Тёмная сторона»',minQuality: 70, rewardSoft: 240, rewardRep: 4, constraints: { min_quality: 70, abv: [4.8, 6.5] } },
  { styleKey: 'pilsner',   customerName: 'Гастробар «Чистота»', minQuality: 75, rewardSoft: 280, rewardRep: 6, constraints: { min_quality: 75 } },
  { styleKey: 'neipa',     customerName: 'Крафт-кофейня «Juicy»',minQuality: 80, rewardSoft: 340, rewardRep: 8, constraints: { min_quality: 80, srm: [2, 8] } },
  { styleKey: 'saison',    customerName: 'Фермерский ресторан', minQuality: 65, rewardSoft: 210, rewardRep: 4, constraints: { min_quality: 65 } },
  { styleKey: 'brown',     customerName: 'Спорт-бар «Осень»',  minQuality: 60, rewardSoft: 190, rewardRep: 3, constraints: { min_quality: 60 } },
  { styleKey: 'witbier',   customerName: 'Летний фестиваль',    minQuality: 55, rewardSoft: 155, rewardRep: 2, constraints: { min_quality: 55 } },
]

// Текущие тренды (спрос): styleKey → multiplier 0.7–1.5
// Меняются при генерации раз в N часов (простая рандомизация с сидом по дате)
function getDemandMultipliers(): Record<string, number> {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const styles = NPC_ORDER_TEMPLATES.map((t) => t.styleKey)
  const result: Record<string, number> = {}
  for (let i = 0; i < styles.length; i++) {
    // псевдорандом детерминированный по дню + индексу
    const seed = (day * 31 + i * 17) % 100
    result[styles[i]] = 0.7 + (seed / 100) * 0.8  // 0.70–1.50
  }
  return result
}

export class MarketError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'MarketError'
  }
}

// ── Генерация заказов ──────────────────────────────────────────────────────────

export async function generateOrdersForBrewery(breweryId: bigint) {
  // Проверяем когда последний раз генерировали
  const latest = await (prisma as any).marketOrder.findFirst({
    where:   { brewery_id: breweryId, status: 'open' },
    orderBy: { created_at: 'desc' },
    select:  { created_at: true },
  })

  const hoursSinceLast = latest
    ? (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60)
    : Infinity

  if (hoursSinceLast < ORDER_GEN_INTERVAL_H) {
    return { generated: 0, reason: 'too_soon' }
  }

  // Считаем сколько активных заказов уже есть
  const activeCount = await (prisma as any).marketOrder.count({
    where: { brewery_id: breweryId, status: 'open' },
  })

  const toGenerate = Math.max(0, MAX_ACTIVE_ORDERS - activeCount)
  if (toGenerate === 0) return { generated: 0, reason: 'max_reached' }

  // Выбираем случайные шаблоны (без повторов)
  const shuffled = [...NPC_ORDER_TEMPLATES].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, toGenerate)

  const deadline = new Date(Date.now() + ORDER_TTL_H * 60 * 60 * 1000)

  await (prisma as any).marketOrder.createMany({
    data: selected.map((t) => ({
      brewery_id:        breweryId,
      customer_name:     t.customerName,
      required_style_key: t.styleKey,
      constraints:       t.constraints,
      reward_soft:       t.rewardSoft,
      reward_reputation: t.rewardRep,
      deadline_at:       deadline,
      status:            'open',
    })),
  })

  return { generated: selected.length }
}

// ── Список заказов пивоварни ───────────────────────────────────────────────────

export async function getOrders(breweryId: bigint) {
  // Сначала экспайрим просроченные
  await (prisma as any).marketOrder.updateMany({
    where: { brewery_id: breweryId, status: 'open', deadline_at: { lte: new Date() } },
    data:  { status: 'expired' },
  })

  // Триггерим генерацию (не ждём)
  void generateOrdersForBrewery(breweryId)

  const orders = await (prisma as any).marketOrder.findMany({
    where:   { brewery_id: breweryId, status: 'open' },
    orderBy: { deadline_at: 'asc' },
  })

  const demandMults = getDemandMultipliers()

  return orders.map(serializeOrder.bind(null, demandMults))
}

// ── Тренды (спрос) ────────────────────────────────────────────────────────────

export async function getTrends() {
  const mults = getDemandMultipliers()
  const styles = await (prisma as any).beerStyle.findMany({
    where:   { is_custom: false },
    select:  { key: true, name: true, base_price: true },
    orderBy: { key: 'asc' },
  })

  return styles
    .filter((s: any) => s.key && mults[s.key] !== undefined)
    .map((s: any) => ({
      styleKey:   s.key,
      styleName:  s.name,
      demandMult: Math.round(mults[s.key] * 100) / 100,
      trend:      mults[s.key] >= 1.2 ? 'up' : mults[s.key] <= 0.85 ? 'down' : 'neutral',
    }))
    .sort((a: any, b: any) => b.demandMult - a.demandMult)
}

// ── Расчёт цены (B.11) ────────────────────────────────────────────────────────

export async function calcBatchSellPrice(batchId: bigint, breweryId: bigint) {
  const batch = await (prisma as any).batch.findUnique({
    where:   { id: batchId },
    include: { style: { select: { key: true, name: true, base_price: true } } },
  })

  if (!batch)                         throw new MarketError('Партия не найдена', 'NOT_FOUND')
  if (batch.brewery_id !== breweryId) throw new MarketError('Нет доступа', 'FORBIDDEN')
  if (batch.status !== 'ready')       throw new MarketError('Партия ещё не готова', 'NOT_READY')
  if (batch.quality == null)          throw new MarketError('Качество не рассчитано', 'NO_QUALITY')

  const user = await (prisma as any).user.findFirst({
    where:  { brewery: { id: breweryId } },
    select: { reputation: true },
  })

  const basePrice  = batch.style?.base_price ?? 90
  const quality    = batch.quality
  const styleKey   = batch.style?.key
  const demandMult = styleKey ? getDemandMultipliers()[styleKey] ?? 1.0 : 1.0
  const repMult    = calcReputationMult(user?.reputation ?? 0)

  const sellPrice  = calcSellPrice(basePrice, quality, demandMult, repMult)

  return {
    batchId:       batchId.toString(),
    styleName:     batch.style?.name ?? null,
    quality,
    basePrice,
    demandMult:    Math.round(demandMult * 100) / 100,
    reputationMult: Math.round(repMult * 100) / 100,
    qualityMult:   Math.round((GAME_CONFIG.price.qualityMultMin + (quality / 100) * 1.5) * 100) / 100,
    sellPrice,
  }
}

// ── Продажа партии ────────────────────────────────────────────────────────────

export async function sellBatch(batchId: bigint, breweryId: bigint) {
  const priceInfo = await calcBatchSellPrice(batchId, breweryId)

  const result = await (prisma as any).$transaction(async (tx: any) => {
    // Помечаем партию как проданную
    const batch = await tx.batch.update({
      where: { id: batchId },
      data:  { status: 'sold' },
      select: { brewery: { include: { owner: { select: { id: true } } } } },
    })

    const userId = batch.brewery.owner.id

    // Начисляем монеты
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data:  { soft_currency: { increment: priceInfo.sellPrice } },
      select: { soft_currency: true },
    })

    // Пишем в журнал транзакций
    await tx.transaction.create({
      data: {
        user_id:  userId,
        type:     'sale',
        currency: 'soft',
        amount:   priceInfo.sellPrice,
        reason:   `Продажа: ${priceInfo.styleName ?? 'пиво'} кач. ${priceInfo.quality}`,
        ref_id:   batchId,
      },
    })

    return { remainingCurrency: updatedUser.soft_currency }
  })

  return { ...priceInfo, remainingCurrency: result.remainingCurrency }
}

// ── Выполнение заказа ─────────────────────────────────────────────────────────

export async function fulfillOrder(
  orderId: bigint,
  batchId: bigint,
  breweryId: bigint,
) {
  const order = await (prisma as any).marketOrder.findUnique({ where: { id: orderId } })
  if (!order)                          throw new MarketError('Заказ не найден', 'NOT_FOUND')
  if (order.brewery_id !== breweryId)  throw new MarketError('Нет доступа к заказу', 'FORBIDDEN')
  if (order.status !== 'open')         throw new MarketError('Заказ уже не активен', 'INVALID_STATUS')
  if (order.deadline_at && new Date(order.deadline_at) < new Date()) {
    await (prisma as any).marketOrder.update({ where: { id: orderId }, data: { status: 'expired' } })
    throw new MarketError('Заказ просрочен', 'EXPIRED')
  }

  const batch = await (prisma as any).batch.findUnique({
    where:   { id: batchId },
    include: { style: { select: { key: true, name: true } } },
  })
  if (!batch)                         throw new MarketError('Партия не найдена', 'BATCH_NOT_FOUND')
  if (batch.brewery_id !== breweryId) throw new MarketError('Нет доступа к партии', 'FORBIDDEN')
  if (batch.status !== 'ready')       throw new MarketError('Партия ещё не готова', 'BATCH_NOT_READY')

  // Проверяем соответствие требованиям
  const issues = checkOrderConstraints(batch, order)
  if (issues.length > 0) {
    throw new MarketError(`Партия не соответствует заказу: ${issues.join(', ')}`, 'CONSTRAINTS_FAILED')
  }

  const result = await (prisma as any).$transaction(async (tx: any) => {
    // Партия → sold, заказ → fulfilled
    await tx.batch.update({ where: { id: batchId }, data: { status: 'sold' } })
    await tx.marketOrder.update({
      where: { id: orderId },
      data:  { status: 'fulfilled', fulfilled_batch_id: batchId },
    })

    const user = await tx.user.findFirst({
      where:  { brewery: { id: breweryId } },
      select: { id: true },
    })

    // Начисляем награду
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data:  {
        soft_currency: { increment: order.reward_soft },
        reputation:    { increment: order.reward_reputation },
      },
      select: { soft_currency: true, reputation: true },
    })

    await tx.transaction.create({
      data: {
        user_id:  user.id,
        type:     'order_reward',
        currency: 'soft',
        amount:   order.reward_soft,
        reason:   `Заказ: ${order.customer_name}`,
        ref_id:   orderId,
      },
    })

    return updatedUser
  })

  return {
    orderId:       orderId.toString(),
    customerName:  order.customer_name,
    rewardSoft:    order.reward_soft,
    rewardRep:     order.reward_reputation,
    remainingCurrency: result.soft_currency,
    reputation:    result.reputation,
  }
}

// ── Вспомогательные ───────────────────────────────────────────────────────────

function calcReputationMult(reputation: number): number {
  const [min, max] = GAME_CONFIG.price.reputationMultRange
  // Репутация 0–500+ → 1.0–1.3 линейно, cap 500
  const factor = Math.min(reputation / 500, 1)
  return Math.round((min + factor * (max - min)) * 100) / 100
}

function checkOrderConstraints(batch: any, order: any): string[] {
  const c = order.constraints as Record<string, unknown>
  const issues: string[] = []

  if (order.required_style_key && batch.style?.key !== order.required_style_key) {
    issues.push(`стиль должен быть ${order.required_style_key}`)
  }
  if (c.min_quality && (batch.quality ?? 0) < (c.min_quality as number)) {
    issues.push(`качество ${batch.quality} < ${c.min_quality}`)
  }
  if (c.ibu) {
    const [lo, hi] = c.ibu as [number, number]
    if (batch.ibu == null || batch.ibu < lo || batch.ibu > hi) {
      issues.push(`IBU ${batch.ibu} не в диапазоне ${lo}–${hi}`)
    }
  }
  if (c.abv) {
    const [lo, hi] = c.abv as [number, number]
    const abv = batch.abv != null ? Number(batch.abv) : null
    if (abv == null || abv < lo || abv > hi) {
      issues.push(`ABV ${abv} не в диапазоне ${lo}–${hi}`)
    }
  }
  if (c.srm) {
    const [lo, hi] = c.srm as [number, number]
    const srm = batch.srm != null ? Number(batch.srm) : null
    if (srm == null || srm < lo || srm > hi) {
      issues.push(`SRM ${srm} не в диапазоне ${lo}–${hi}`)
    }
  }
  return issues
}

function serializeOrder(demandMults: Record<string, number>, o: any) {
  const styleKey   = o.required_style_key
  const demandMult = styleKey ? (demandMults[styleKey] ?? 1.0) : 1.0
  return {
    id:           o.id.toString(),
    customerName: o.customer_name,
    styleKey,
    constraints:  o.constraints,
    rewardSoft:   o.reward_soft,
    rewardRep:    o.reward_reputation,
    deadlineAt:   o.deadline_at,
    hoursLeft:    o.deadline_at
      ? Math.max(0, Math.round((new Date(o.deadline_at).getTime() - Date.now()) / 3_600_000))
      : null,
    demandMult:   Math.round(demandMult * 100) / 100,
    trend:        demandMult >= 1.2 ? 'up' : demandMult <= 0.85 ? 'down' : 'neutral',
  }
}
