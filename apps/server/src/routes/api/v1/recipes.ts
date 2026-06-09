import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../../middleware/auth.js'
import { prisma } from '../../../db/client.js'
import { LEVEL_UNLOCKS } from '../../../game/progression.js'

// Стартовые рецепты — выдаются бесплатно
export const STARTER_RECIPES = ['pale_ale']

// Убедиться что стартовые рецепты есть у пивоварни
export async function ensureStarterRecipes(breweryId: bigint) {
  for (const key of STARTER_RECIPES) {
    await (prisma as any).recipeUnlock.upsert({
      where:  { brewery_id_style_key: { brewery_id: breweryId, style_key: key } },
      update: {},
      create: { brewery_id: breweryId, style_key: key, source: 'starter' },
    })
  }
}

export async function recipeRoutes(app: FastifyInstance) {

  // ── GET /api/v1/recipes/owned ─────────────────────────────────────────────
  // Все разблокированные рецепты пивоварни
  app.get('/recipes/owned', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const user = await (prisma as any).user.findUnique({
        where:  { telegram_id: BigInt(request.telegramUser.id) },
        select: { brewery: { select: { id: true } } },
      })
      if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

      await ensureStarterRecipes(user.brewery.id)

      const unlocks = await (prisma as any).recipeUnlock.findMany({
        where:   { brewery_id: user.brewery.id },
        orderBy: { unlocked_at: 'asc' },
      })

      return reply.send({ items: unlocks.map((u: any) => ({
        styleKey:   u.style_key,
        source:     u.source,
        unlockedAt: u.unlocked_at,
      })) })
    } catch (err) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ── GET /api/v1/recipes/shop ──────────────────────────────────────────────
  // Рецепты доступные к покупке на текущем уровне (ещё не куплены)
  app.get('/recipes/shop', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const user = await (prisma as any).user.findUnique({
        where:  { telegram_id: BigInt(request.telegramUser.id) },
        select: { level: true, soft_currency: true, brewery: { select: { id: true } } },
      })
      if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

      const ownedKeys = await (prisma as any).recipeUnlock.findMany({
        where:  { brewery_id: user.brewery.id },
        select: { style_key: true },
      })
      const owned = new Set(ownedKeys.map((u: any) => u.style_key))

      // Рецепты доступные к покупке = level_unlock.type === 'recipe' && unlock.level <= userLevel
      const available = LEVEL_UNLOCKS
        .filter(u => u.type === 'recipe' && u.level <= user.level && !owned.has(u.recipe_key!))
        .map(u => ({
          styleKey:    u.recipe_key,
          name:        u.recipe_name,
          price:       u.recipe_price,
          unlockLevel: u.level,
          canAfford:   (user.soft_currency ?? 0) >= (u.recipe_price ?? 0),
        }))

      return reply.send({ items: available })
    } catch (err) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ── POST /api/v1/recipes/buy ──────────────────────────────────────────────
  // Купить рецепт { styleKey }
  app.post<{ Body: { styleKey: string } }>(
    '/recipes/buy',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { styleKey } = request.body

        const user = await (prisma as any).user.findUnique({
          where:  { telegram_id: BigInt(request.telegramUser.id) },
          select: { id: true, level: true, soft_currency: true, brewery: { select: { id: true } } },
        })
        if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

        // Найти в таблице разблокировок
        const unlockDef = LEVEL_UNLOCKS.find(u => u.type === 'recipe' && u.recipe_key === styleKey)
        if (!unlockDef) return reply.code(400).send({ error: 'Рецепт не найден' })

        if (user.level < unlockDef.level) {
          return reply.code(400).send({ error: `Требуется уровень ${unlockDef.level}` })
        }

        const price = unlockDef.recipe_price ?? 0

        // Уже есть?
        const existing = await (prisma as any).recipeUnlock.findUnique({
          where: { brewery_id_style_key: { brewery_id: user.brewery.id, style_key: styleKey } },
        })
        if (existing) return reply.code(400).send({ error: 'Рецепт уже разблокирован' })

        if (user.soft_currency < price) {
          return reply.code(400).send({ error: 'INSUFFICIENT_FUNDS' })
        }

        await (prisma as any).$transaction([
          (prisma as any).user.update({
            where: { id: user.id },
            data:  { soft_currency: { decrement: price } },
          }),
          (prisma as any).recipeUnlock.create({
            data: { brewery_id: user.brewery.id, style_key: styleKey, source: 'purchase' },
          }),
        ])

        return reply.send({ ok: true, styleKey })
      } catch (err) {
        request.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    }
  )

  // ── POST /api/v1/recipes/grant ────────────────────────────────────────────
  // Выдать рецепт за заказ (вызывается из market service)
  app.post<{ Body: { styleKey: string; source: string } }>(
    '/recipes/grant',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { styleKey, source } = request.body

        const user = await (prisma as any).user.findUnique({
          where:  { telegram_id: BigInt(request.telegramUser.id) },
          select: { brewery: { select: { id: true } } },
        })
        if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

        await (prisma as any).recipeUnlock.upsert({
          where:  { brewery_id_style_key: { brewery_id: user.brewery.id, style_key: styleKey } },
          update: {},
          create: { brewery_id: user.brewery.id, style_key: styleKey, source: source ?? 'order_reward' },
        })

        return reply.send({ ok: true })
      } catch (err) {
        request.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    }
  )
}
