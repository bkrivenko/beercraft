import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../../middleware/auth.js'
import { prisma } from '../../../db/client.js'
import { getOrCreateUser } from '../../../services/user.service.js'
import { getProgressionSummary, getUnlocksForLevel } from '../../../game/progression.js'

export async function meRoutes(app: FastifyInstance) {

  // ── GET /api/v1/me ──────────────────────────────────────────────────────────
  // Профиль + данные прогрессии
  app.get('/me', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const profile    = await getOrCreateUser(request.telegramUser)
      const progression = getProgressionSummary(profile.level, profile.xp)
      return reply.code(200).send({ ...profile, progression })
    } catch (err) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ── POST /api/v1/me/onboarding-done ────────────────────────────────────────
  app.post('/me/onboarding-done', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      await (prisma as any).user.update({
        where: { telegram_id: BigInt(request.telegramUser.id) },
        data:  { onboarding_done: true },
      })
      return reply.send({ ok: true })
    } catch (err) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ── GET /api/v1/me/stats ────────────────────────────────────────────────────
  // Статистика для экрана профиля Э-8
  app.get('/me/stats', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const user = await (prisma as any).user.findUnique({
        where:  { telegram_id: BigInt(request.telegramUser.id) },
        select: {
          id: true, display_name: true, level: true, xp: true,
          soft_currency: true, reputation: true, created_at: true,
          brewery: { select: { id: true, name: true } },
        },
      })
      if (!user) return reply.code(404).send({ error: 'User not found' })

      // Статистика варок
      const brewsTotal = await (prisma as any).batch.count({
        where: { brewery_id: user.brewery?.id },
      })
      const soldBatches = await (prisma as any).batch.findMany({
        where:  { brewery_id: user.brewery?.id, status: 'sold', quality: { not: null } },
        select: { quality: true },
      })
      const avgQuality = soldBatches.length > 0
        ? Math.round(soldBatches.reduce((s: number, b: any) => s + (b.quality ?? 0), 0) / soldBatches.length)
        : null

      // Лучшие партии
      const topBatches = await (prisma as any).batch.findMany({
        where:   { brewery_id: user.brewery?.id, quality: { not: null } },
        orderBy: { quality: 'desc' },
        take:    3,
        include: { style: { select: { name: true } } },
      })

      // Транзакции — суммарный доход
      const income = await (prisma as any).transaction.aggregate({
        where:   { user_id: user.id, type: { in: ['sale', 'order_reward'] } },
        _sum:    { amount: true },
      })

      const progression = getProgressionSummary(user.level, user.xp)

      return reply.send({
        displayName:    user.display_name,
        level:          user.level,
        xp:             user.xp,
        softCurrency:   user.soft_currency,
        reputation:     user.reputation,
        createdAt:      user.created_at,
        breweryName:    user.brewery?.name ?? null,
        progression,
        stats: {
          brewsTotal,
          soldBatches: soldBatches.length,
          avgQuality,
          totalIncome: income._sum.amount ?? 0,
        },
        topBatches: topBatches.map((b: any) => ({
          quality:   b.quality,
          styleName: b.style?.name ?? 'Пиво',
          abv:       b.abv != null ? Number(b.abv) : null,
          ibu:       b.ibu,
        })),
        nextLevelUnlocks: getUnlocksForLevel(user.level + 1),
      })
    } catch (err) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
