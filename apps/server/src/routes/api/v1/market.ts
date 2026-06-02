import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../../middleware/auth.js'
import { prisma } from '../../../db/client.js'
import {
  getOrders, getTrends, calcBatchSellPrice, sellBatch, fulfillOrder,
  MarketError,
} from '../../../services/market.service.js'

export async function marketRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  // ── GET /api/v1/market/orders ─────────────────────────────────────────────
  // Список активных заказов NPC (+ триггер генерации если пора)
  app.get('/market/orders', async (request, reply) => {
    const brewery = await getBrewery(request.telegramUser.id)
    if (!brewery) return reply.code(404).send({ error: 'Brewery not found' })

    const orders = await getOrders(brewery.id)
    return reply.send({ items: orders, total: orders.length })
  })

  // ── GET /api/v1/market/trends ─────────────────────────────────────────────
  // Текущий спрос по стилям (детерминированный по дате)
  app.get('/market/trends', async (_request, reply) => {
    const trends = await getTrends()
    return reply.send({ items: trends })
  })

  // ── GET /api/v1/market/batches ────────────────────────────────────────────
  // Готовые партии на складе (status=ready) с предрасчётом цены
  app.get('/market/batches', async (request, reply) => {
    const brewery = await getBrewery(request.telegramUser.id)
    if (!brewery) return reply.code(404).send({ error: 'Brewery not found' })

    const batches = await (prisma as any).batch.findMany({
      where:   { brewery_id: brewery.id, status: 'ready' },
      include: { style: { select: { key: true, name: true, base_price: true } } },
      orderBy: { started_at: 'desc' },
    })

    const user = await (prisma as any).user.findFirst({
      where:  { brewery: { id: brewery.id } },
      select: { reputation: true },
    })

    const results = await Promise.all(
      batches.map(async (b: any) => {
        try {
          const price = await calcBatchSellPrice(BigInt(b.id), brewery.id)
          return { ...serializeBatch(b), ...price }
        } catch {
          return serializeBatch(b)
        }
      }),
    )

    return reply.send({ items: results, total: results.length, reputation: user?.reputation ?? 0 })
  })

  // ── POST /api/v1/market/sell ──────────────────────────────────────────────
  // Продать партию по рыночной цене (B.11): { batchId }
  app.post<{ Body: { batchId: string } }>(
    '/market/sell',
    {
      schema: {
        body: {
          type: 'object', required: ['batchId'],
          properties: { batchId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const brewery = await getBrewery(request.telegramUser.id)
      if (!brewery) return reply.code(404).send({ error: 'Brewery not found' })

      try {
        const result = await sellBatch(BigInt(request.body.batchId), brewery.id)
        return reply.send(result)
      } catch (err) {
        return handleMarketError(err, reply, request)
      }
    },
  )

  // ── GET /api/v1/market/sell-price/:batchId ────────────────────────────────
  // Предпросмотр цены перед продажей (для экрана подтверждения)
  app.get<{ Params: { batchId: string } }>(
    '/market/sell-price/:batchId',
    async (request, reply) => {
      const brewery = await getBrewery(request.telegramUser.id)
      if (!brewery) return reply.code(404).send({ error: 'Brewery not found' })

      try {
        const price = await calcBatchSellPrice(BigInt(request.params.batchId), brewery.id)
        return reply.send(price)
      } catch (err) {
        return handleMarketError(err, reply, request)
      }
    },
  )

  // ── POST /api/v1/market/fulfill ───────────────────────────────────────────
  // Выполнить заказ NPC: { orderId, batchId }
  app.post<{ Body: { orderId: string; batchId: string } }>(
    '/market/fulfill',
    {
      schema: {
        body: {
          type: 'object', required: ['orderId', 'batchId'],
          properties: {
            orderId:  { type: 'string' },
            batchId:  { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const brewery = await getBrewery(request.telegramUser.id)
      if (!brewery) return reply.code(404).send({ error: 'Brewery not found' })

      try {
        const result = await fulfillOrder(
          BigInt(request.body.orderId),
          BigInt(request.body.batchId),
          brewery.id,
        )
        return reply.send(result)
      } catch (err) {
        return handleMarketError(err, reply, request)
      }
    },
  )
}

// ── Хелперы ───────────────────────────────────────────────────────────────────

async function getBrewery(telegramId: number) {
  const user = await (prisma as any).user.findUnique({
    where:  { telegram_id: BigInt(telegramId) },
    select: { brewery: { select: { id: true } } },
  })
  return user?.brewery ?? null
}

function serializeBatch(b: any) {
  return {
    id:        b.id.toString(),
    styleName: b.style?.name ?? null,
    styleKey:  b.style?.key ?? null,
    quality:   b.quality,
    abv:       b.abv != null ? Number(b.abv) : null,
    ibu:       b.ibu,
    srm:       b.srm != null ? Number(b.srm) : null,
    volumeL:   Number(b.volume_l),
  }
}

function handleMarketError(err: unknown, reply: any, request: any) {
  if (err instanceof MarketError) {
    const status =
      err.code === 'NOT_FOUND'     ? 404
      : err.code === 'FORBIDDEN'   ? 403
      : err.code === 'NOT_READY'   ? 409
      : err.code === 'CONSTRAINTS_FAILED' ? 422
      : 400
    return reply.code(status).send({ error: err.message, code: err.code })
  }
  request.log.error(err)
  return reply.code(500).send({ error: 'Internal server error' })
}
