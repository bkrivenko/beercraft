import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../../middleware/auth.js'
import { prisma } from '../../../db/client.js'
import {
  startBatch,
  completeStage,
  getBatches,
  BatchError,
  type RecipePayload,
  type StageAccuracy,
} from '../../../services/batch.service.js'

export async function batchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  // ── GET /api/v1/batches ────────────────────────────────────────────────────
  // Список партий пивоварни с таймерами (auto-advance статусов)
  app.get('/batches', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { telegram_id: BigInt(request.telegramUser.id) },
      select: { brewery: { select: { id: true } } },
    })
    if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

    const batches = await getBatches(user.brewery.id)
    return reply.send({ items: batches, total: batches.length })
  })

  // ── POST /api/v1/batches/start ─────────────────────────────────────────────
  // Создать партию + запустить таймер затирания
  app.post<{ Body: RecipePayload }>(
    '/batches/start',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'malts', 'hops', 'yeastKey', 'waterKey', 'mashTempC', 'fermentTempC', 'volumeL'],
          properties: {
            name:            { type: 'string', minLength: 1, maxLength: 100 },
            targetStyleKey:  { type: 'string' },
            malts: {
              type: 'array', minItems: 1,
              items: {
                type: 'object',
                required: ['key', 'amountKg'],
                properties: {
                  key:      { type: 'string' },
                  amountKg: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
                },
              },
            },
            hops: {
              type: 'array', minItems: 1,
              items: {
                type: 'object',
                required: ['key', 'amountG', 'timing'],
                properties: {
                  key:    { type: 'string' },
                  amountG:{ type: 'number', exclusiveMinimum: 0, maximum: 2000 },
                  timing: { type: 'string', enum: ['bittering', 'flavor', 'aroma', 'dry_hop'] },
                },
              },
            },
            yeastKey:     { type: 'string' },
            waterKey:     { type: 'string' },
            mashTempC:    { type: 'number', minimum: 60, maximum: 75 },
            fermentTempC: { type: 'number', minimum: 5, maximum: 35 },
            volumeL:      { type: 'number', exclusiveMinimum: 0, maximum: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { telegram_id: BigInt(request.telegramUser.id) },
        select: { id: true, brewery: { select: { id: true } } },
      })
      if (!user)          return reply.code(404).send({ error: 'User not found' })
      if (!user.brewery)  return reply.code(404).send({ error: 'Brewery not found' })

      try {
        const batch = await startBatch(user.id, user.brewery.id, request.body)
        return reply.code(201).send(batch)
      } catch (err) {
        if (err instanceof BatchError) {
          const status =
            err.code === 'NOT_FOUND'          ? 404
            : err.code === 'INGREDIENT_NOT_FOUND' ? 404
            : err.code === 'INSUFFICIENT_STOCK'   ? 409
            : 400
          return reply.code(status).send({ error: err.message, code: err.code })
        }
        request.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )

  // ── POST /api/v1/batches/:id/complete-stage ────────────────────────────────
  // Клиент завершает активный этап и присылает точность { accuracy: { mash, hops, chill } }
  app.post<{
    Params: { id: string }
    Body:   { accuracy: StageAccuracy }
  }>(
    '/batches/:id/complete-stage',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['accuracy'],
          properties: {
            accuracy: {
              type: 'object',
              required: ['mash', 'hops', 'chill'],
              properties: {
                mash:    { type: 'number', minimum: 0, maximum: 1 },
                hops:    { type: 'number', minimum: 0, maximum: 1 },
                chill:   { type: 'number', minimum: 0, maximum: 1 },
                ferment: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { telegram_id: BigInt(request.telegramUser.id) },
        select: { brewery: { select: { id: true } } },
      })
      if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

      const batchId = BigInt(request.params.id)

      try {
        const result = await completeStage(batchId, user.brewery.id, request.body.accuracy)
        return reply.send(result)
      } catch (err) {
        if (err instanceof BatchError) {
          const status =
            err.code === 'NOT_FOUND'       ? 404
            : err.code === 'FORBIDDEN'     ? 403
            : err.code === 'INVALID_STATUS'? 409
            : 400
          return reply.code(status).send({ error: err.message, code: err.code })
        }
        request.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )
}
