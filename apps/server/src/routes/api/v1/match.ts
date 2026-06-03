import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../../middleware/auth.js'
import { prisma } from '../../../db/client.js'
import {
  getMatch, submitResult, finishMatch, getSeedData,
  MatchError,
} from '../../../services/match.service.js'

export async function matchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  // ── GET /api/v1/match/:id ──────────────────────────────────────────────────
  // Состояние матча (участники, результаты, победитель)
  app.get<{ Params: { id: string } }>(
    '/match/:id',
    async (request, reply) => {
      const user = await resolveUser(request.telegramUser.id)
      if (!user) return reply.code(404).send({ error: 'User not found' })

      try {
        const match = await getMatch(BigInt(request.params.id), user.id)
        return reply.send(match)
      } catch (err) {
        return handleError(err, reply, request)
      }
    },
  )

  // ── GET /api/v1/match/:id/seed-data ───────────────────────────────────────
  // Детерминированные данные для мини-игры (дрейф температуры)
  // Оба игрока получают одинаковую последовательность по seed
  app.get<{ Params: { id: string }; Querystring: { steps?: string } }>(
    '/match/:id/seed-data',
    async (request, reply) => {
      const user = await resolveUser(request.telegramUser.id)
      if (!user) return reply.code(404).send({ error: 'User not found' })

      const match = await (prisma as any).match.findUnique({
        where:  { id: BigInt(request.params.id) },
        select: { id: true, seed: true, status: true },
      })
      if (!match) return reply.code(404).send({ error: 'Match not found' })

      // Проверяем участие
      const isParticipant = await (prisma as any).matchParticipant.findUnique({
        where: {
          match_id_user_id: { match_id: match.id, user_id: user.id },
        },
      })
      if (!isParticipant) return reply.code(403).send({ error: 'Not a participant' })

      const steps = Math.min(Number(request.query.steps ?? 60), 300)
      return reply.send(getSeedData(match.seed, steps))
    },
  )

  // ── POST /api/v1/match/:id/submit ─────────────────────────────────────────
  // Игрок привязывает свою партию к матчу: { batchId }
  app.post<{
    Params: { id: string }
    Body:   { batchId: string }
  }>(
    '/match/:id/submit',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['batchId'],
          properties: { batchId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const user = await resolveUser(request.telegramUser.id)
      if (!user) return reply.code(404).send({ error: 'User not found' })

      try {
        const result = await submitResult(
          BigInt(request.params.id),
          user.id,
          BigInt(request.body.batchId),
        )
        return reply.send(result)
      } catch (err) {
        return handleError(err, reply, request)
      }
    },
  )

  // ── POST /api/v1/match/:id/finish ─────────────────────────────────────────
  // Принудительное завершение (только участник / таймаут)
  app.post<{ Params: { id: string } }>(
    '/match/:id/finish',
    async (request, reply) => {
      const user = await resolveUser(request.telegramUser.id)
      if (!user) return reply.code(404).send({ error: 'User not found' })

      // Только участник может форс-финишировать
      const isParticipant = await (prisma as any).matchParticipant.findUnique({
        where: {
          match_id_user_id: {
            match_id: BigInt(request.params.id),
            user_id:  user.id,
          },
        },
      })
      if (!isParticipant) return reply.code(403).send({ error: 'Not a participant' })

      try {
        const result = await finishMatch(BigInt(request.params.id))
        return reply.send(result)
      } catch (err) {
        return handleError(err, reply, request)
      }
    },
  )

  // ── GET /api/v1/match/history ─────────────────────────────────────────────
  // История матчей игрока (последние 20)
  app.get('/match/history', async (request, reply) => {
    const user = await resolveUser(request.telegramUser.id)
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const matches = await (prisma as any).match.findMany({
      where: {
        participants: { some: { user_id: user.id } },
        status:       { in: ['finished', 'cancelled'] },
      },
      orderBy: { finished_at: 'desc' },
      take:    20,
      include: {
        participants: {
          include: { user: { select: { display_name: true } } },
        },
      },
    })

    return reply.send({
      items: matches.map((m: any) => {
        const myPart = m.participants.find((p: any) => p.user_id === user.id)
        const opponent = m.participants.find((p: any) => p.user_id !== user.id)
        return {
          matchId:         m.id.toString(),
          mode:            m.mode,
          status:          m.status,
          myResult:        myPart?.result ?? null,
          myScore:         myPart?.score ?? null,
          opponentName:    opponent?.user?.display_name ?? null,
          opponentScore:   opponent?.score ?? null,
          finishedAt:      m.finished_at,
          styleKey:        (m.task as any)?.styleKey ?? null,
        }
      }),
    })
  })
}

// ── Хелперы ───────────────────────────────────────────────────────────────────

async function resolveUser(telegramId: number) {
  return (prisma as any).user.findUnique({
    where:  { telegram_id: BigInt(telegramId) },
    select: { id: true },
  })
}

function handleError(err: unknown, reply: any, request: any) {
  if (err instanceof MatchError) {
    const status =
      err.code === 'NOT_FOUND'        ? 404
      : err.code === 'FORBIDDEN'      ? 403
      : err.code === 'INVALID_STATUS' ? 409
      : err.code === 'ALREADY_SUBMITTED' ? 409
      : 400
    return reply.code(status).send({ error: err.message, code: err.code })
  }
  request.log.error(err)
  return reply.code(500).send({ error: 'Internal server error' })
}
