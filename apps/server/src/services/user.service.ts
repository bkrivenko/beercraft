import { prisma } from '../db/client.js'
import type { TelegramUser } from '../middleware/auth.js'

export async function getOrCreateUser(tgUser: TelegramUser) {
  const displayName =
    [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') ||
    tgUser.username ||
    `User${tgUser.id}`

  // upsert: создаём при первом входе, обновляем last_seen_at и имя
  const user = await prisma.user.upsert({
    where: { telegram_id: BigInt(tgUser.id) },
    create: {
      telegram_id: BigInt(tgUser.id),
      username: tgUser.username ?? null,
      display_name: displayName,
      locale: tgUser.language_code ?? 'ru',
      last_seen_at: new Date(),
      soft_currency: 500,   // стартовые монеты для покупки ингредиентов
    },
    update: {
      username: tgUser.username ?? null,
      display_name: displayName,
      last_seen_at: new Date(),
    },
    select: {
      id: true,
      telegram_id: true,
      username: true,
      display_name: true,
      level: true,
      xp: true,
      soft_currency: true,
      premium_currency: true,
      reputation: true,
      locale: true,
      age_confirmed: true,
      created_at: true,
      last_seen_at: true,
    },
  })

  // Если у пользователя ещё нет пивоварни — создаём автоматически
  const existingBrewery = await prisma.brewery.findUnique({
    where: { owner_id: user.id },
    select: { id: true, name: true, treasury: true, created_at: true },
  })

  const brewery =
    existingBrewery ??
    (await prisma.brewery.create({
      data: {
        owner_id: user.id,
        name: `${displayName}'s Brewery`,
      },
      select: { id: true, name: true, treasury: true, created_at: true },
    }))

  return {
    // BigInt → string для JSON-сериализации
    id: user.id.toString(),
    telegramId: user.telegram_id.toString(),
    username: user.username,
    displayName: user.display_name,
    level: user.level,
    xp: user.xp,
    softCurrency: user.soft_currency,
    premiumCurrency: user.premium_currency,
    reputation: user.reputation,
    locale: user.locale,
    ageConfirmed: user.age_confirmed,
    createdAt: user.created_at,
    lastSeenAt: user.last_seen_at,
    brewery: {
      id: brewery.id.toString(),
      name: brewery.name,
      treasury: brewery.treasury,
      createdAt: brewery.created_at,
    },
  }
}
