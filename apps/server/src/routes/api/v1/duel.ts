/**
 * Duel invite API
 *
 * POST /api/v1/duel/invite   — создать комнату + отправить invite другу через бота
 * POST /api/v1/duel/notify-result — уведомить обоих игроков о результате дуэли
 */

import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../../middleware/auth.js'
import { prisma } from '../../../db/client.js'
import { makeInviteLink, notifyDuelInvite, notifyDuelResult } from '../../../lib/bot.js'

export async function duelRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  // ── POST /api/v1/duel/invite ───────────────────────────────────────────────
  // Создаёт invite-ссылку и (опционально) отправляет уведомление другу
  // Body: { roomCode: string, toUsername?: string, toTelegramId?: number }
  app.post<{
    Body: {
      roomCode:     string
      toTelegramId?: number
      styleName?:   string
    }
  }>(
    '/duel/invite',
    {
      schema: {
        body: {
          type: 'object',
          required: ['roomCode'],
          properties: {
            roomCode:     { type: 'string', minLength: 6, maxLength: 6 },
            toTelegramId: { type: 'number' },
            styleName:    { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { roomCode, toTelegramId, styleName } = request.body

      // Находим отправителя
      const sender = await (prisma as any).user.findUnique({
        where:  { telegram_id: BigInt(request.telegramUser.id) },
        select: { display_name: true, telegram_id: true },
      })
      if (!sender) return reply.code(404).send({ error: 'User not found' })

      const inviteLink = makeInviteLink(roomCode)

      // Если указан получатель — шлём ему уведомление
      if (toTelegramId) {
        const recipient = await (prisma as any).user.findUnique({
          where:  { telegram_id: BigInt(toTelegramId) },
          select: { id: true },
        })

        if (recipient) {
          await notifyDuelInvite({
            toTelegramId,
            fromName:  sender.display_name ?? 'Пивовар',
            roomCode:  roomCode.toUpperCase(),
            styleName,
          })
        }
      }

      return reply.send({
        roomCode:   roomCode.toUpperCase(),
        inviteLink,
        // Telegram share URL для кнопки «Поделиться»
        shareUrl: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('⚔️ Вызываю тебя на дуэль в BeerCraft!')}`,
      })
    },
  )

  // ── POST /api/v1/duel/notify-result ──────────────────────────────────────
  // Внутренний: вызывается из match.service после finishMatch
  // Body: matchId — сервис сам находит участников и шлёт уведомления
  app.post<{ Body: { matchId: string } }>(
    '/duel/notify-result',
    {
      schema: {
        body: {
          type: 'object',
          required: ['matchId'],
          properties: { matchId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const matchId = BigInt(request.body.matchId)

      const match = await (prisma as any).match.findUnique({
        where:   { id: matchId },
        include: {
          participants: {
            include: { user: { select: { telegram_id: true, display_name: true } } },
          },
        },
      })

      if (!match) return reply.code(404).send({ error: 'Match not found' })

      // Текущий рейтинг каждого участника
      const season = await (prisma as any).ratingSeason.findFirst({
        where:   { starts_at: { lte: new Date() }, ends_at: { gte: new Date() } },
        orderBy: { starts_at: 'desc' },
        select:  { id: true },
      })

      const ratings: Record<string, number> = {}
      if (season) {
        const rows = await (prisma as any).rating.findMany({
          where:  { season_id: season.id, user_id: { in: match.participants.map((p: any) => p.user_id) } },
          select: { user_id: true, rating: true },
        })
        for (const r of rows) ratings[r.user_id.toString()] = r.rating
      }

      for (const p of match.participants) {
        const opp = match.participants.find((o: any) => o.user_id !== p.user_id)
        const tgId = p.user?.telegram_id
        if (!tgId) continue

        await notifyDuelResult({
          telegramId:  tgId,
          result:      p.result as 'win' | 'loss' | 'draw',
          myQuality:   p.score,
          oppName:     opp?.user?.display_name ?? 'Соперник',
          oppQuality:  opp?.score ?? null,
          ratingDelta: 0,   // будет уточнено при наличии истории Эло
          newRating:   ratings[p.user_id.toString()] ?? 1000,
        })
      }

      return reply.send({ notified: match.participants.length })
    },
  )
}
