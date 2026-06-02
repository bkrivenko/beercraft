import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../../middleware/auth.js'
import { prisma } from '../../../db/client.js'
import {
  getIngredientsCatalog,
  getInventory,
  purchaseIngredient,
  PurchaseError,
} from '../../../services/inventory.service.js'

interface PurchaseBody {
  ingredientKey: string
  quantity: number
}

export async function ingredientRoutes(app: FastifyInstance) {
  // Все роуты требуют Telegram авторизации
  app.addHook('preHandler', authMiddleware)

  // ── GET /api/v1/ingredients ───────────────────────────────────────────────
  // Каталог ингредиентов, доступных на уровне игрока
  app.get('/ingredients', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { telegram_id: BigInt(request.telegramUser.id) },
      select: { level: true },
    })
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const catalog = await getIngredientsCatalog(user.level)
    return reply.send({ items: catalog, total: catalog.length })
  })

  // ── GET /api/v1/inventory ─────────────────────────────────────────────────
  // Склад ингредиентов пивоварни текущего игрока
  app.get('/inventory', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { telegram_id: BigInt(request.telegramUser.id) },
      select: { brewery: { select: { id: true } } },
    })
    if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

    const inventory = await getInventory(user.brewery.id)
    return reply.send({ items: inventory, total: inventory.length })
  })

  // ── POST /api/v1/inventory/purchase ───────────────────────────────────────
  // Купить ингредиент: { ingredientKey, quantity }
  app.post<{ Body: PurchaseBody }>(
    '/inventory/purchase',
    {
      schema: {
        body: {
          type: 'object',
          required: ['ingredientKey', 'quantity'],
          properties: {
            ingredientKey: { type: 'string', minLength: 1 },
            quantity: { type: 'number', exclusiveMinimum: 0, maximum: 1000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { ingredientKey, quantity } = request.body

      const user = await prisma.user.findUnique({
        where: { telegram_id: BigInt(request.telegramUser.id) },
        select: {
          id: true,
          level: true,
          soft_currency: true,
          brewery: { select: { id: true } },
        },
      })
      if (!user) return reply.code(404).send({ error: 'User not found' })
      if (!user.brewery) return reply.code(404).send({ error: 'Brewery not found' })

      try {
        const result = await purchaseIngredient({
          userId: user.id,
          breweryId: user.brewery.id,
          ingredientKey,
          quantity,
          playerLevel: user.level,
        })
        return reply.code(200).send(result)
      } catch (err) {
        if (err instanceof PurchaseError) {
          const status =
            err.code === 'NOT_FOUND' ? 404
            : err.code === 'LOCKED' ? 403
            : err.code === 'INSUFFICIENT_FUNDS' ? 402
            : 400
          return reply.code(status).send({ error: err.message, code: err.code })
        }
        request.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )
}
