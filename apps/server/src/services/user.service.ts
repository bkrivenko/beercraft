import { prisma } from '../db/client.js'
import type { TelegramUser } from '../middleware/auth.js'

// ── Стартовый набор ингредиентов (хватает на 1 варку Pale Ale 20л) ────────────
const STARTER_INGREDIENTS: Array<{ key: string; quantity: number }> = [
  { key: 'pale_2row', quantity: 5 },    // 5 кг солода
  { key: 'cascade',   quantity: 1 },    // 1×100г хмеля
  { key: 'us05',      quantity: 1 },    // 1 pitch дрожжей
]
const STARTER_COINS = 500

// ── Выдать стартовый набор пивоварне ─────────────────────────────────────────
// Выдаётся ОДИН РАЗ: проверяем флаг starter_pack_given в БД
export async function giveStarterPack(userId: bigint, breweryId: bigint): Promise<void> {
  // Проверяем флаг — если уже выдавали, выходим
  const user = await (prisma as any).user.findUnique({
    where:  { id: userId },
    select: { starter_pack_given: true },
  })
  if (!user || user.starter_pack_given) return

  // Ставим флаг сразу (до выдачи) — защита от двойной выдачи при гонке
  await (prisma as any).user.update({
    where: { id: userId },
    data:  { starter_pack_given: true, soft_currency: { increment: STARTER_COINS } },
  })

  // Ингредиенты
  for (const { key, quantity } of STARTER_INGREDIENTS) {
    const ingredient = await (prisma as any).ingredient.findUnique({
      where: { key },
      select: { id: true },
    })
    if (!ingredient) continue   // seed ещё не запускался — пропускаем

    await (prisma as any).inventory.upsert({
      where: {
        brewery_id_ingredient_id: {
          brewery_id:    breweryId,
          ingredient_id: ingredient.id,
        },
      },
      create:  { brewery_id: breweryId, ingredient_id: ingredient.id, quantity },
      update:  { quantity: { increment: quantity } },
    })
  }
}

// ── Выдать стартовый набор ВСЕМ существующим пользователям ───────────────────
// Вызывается при старте сервера
export async function giveStarterPackToAll(): Promise<void> {
  const breweries = await (prisma as any).brewery.findMany({
    select: { id: true, owner_id: true },
  })
  for (const brewery of breweries) {
    try {
      await giveStarterPack(brewery.owner_id, brewery.id)
    } catch { /* не ломаем всё если один юзер упал */ }
  }
  console.log(`[starter] pack applied to ${breweries.length} breweries`)
}

// ── Создать / обновить пользователя ───────────────────────────────────────────
export async function getOrCreateUser(tgUser: TelegramUser) {
  const displayName =
    [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') ||
    tgUser.username ||
    `User${tgUser.id}`

  const user = await prisma.user.upsert({
    where: { telegram_id: BigInt(tgUser.id) },
    create: {
      telegram_id:   BigInt(tgUser.id),
      username:      tgUser.username ?? null,
      display_name:  displayName,
      locale:        tgUser.language_code ?? 'ru',
      last_seen_at:  new Date(),
      soft_currency: 0,   // монеты дадим через giveStarterPack
    },
    update: {
      username:     tgUser.username ?? null,
      display_name: displayName,
      last_seen_at: new Date(),
    },
    select: {
      id: true, telegram_id: true, username: true, display_name: true,
      level: true, xp: true, soft_currency: true, premium_currency: true,
      reputation: true, locale: true, age_confirmed: true,
      onboarding_done: true,
      created_at: true, last_seen_at: true,
    },
  })

  // Пивоварня
  const existingBrewery = await prisma.brewery.findUnique({
    where:  { owner_id: user.id },
    select: { id: true, name: true, treasury: true, created_at: true },
  })

  const brewery =
    existingBrewery ??
    (await prisma.brewery.create({
      data:   { owner_id: user.id, name: `${displayName}'s Brewery` },
      select: { id: true, name: true, treasury: true, created_at: true },
    }))

  // Стартовый набор (идемпотентно)
  await giveStarterPack(user.id, brewery.id).catch(() => {})

  return {
    id:              user.id.toString(),
    telegramId:      user.telegram_id.toString(),
    username:        user.username,
    displayName:     user.display_name,
    level:           user.level,
    xp:              user.xp,
    softCurrency:    user.soft_currency,
    premiumCurrency: user.premium_currency,
    reputation:      user.reputation,
    locale:          user.locale,
    ageConfirmed:    user.age_confirmed,
    onboardingDone:  user.onboarding_done,
    createdAt:       user.created_at,
    lastSeenAt:      user.last_seen_at,
    brewery: {
      id:        brewery.id.toString(),
      name:      brewery.name,
      treasury:  brewery.treasury,
      createdAt: brewery.created_at,
    },
  }
}
