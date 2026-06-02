import 'dotenv/config'
import Fastify from 'fastify'
import { prisma } from './db/client.js'
import { closeRedis } from './lib/redis.js'
import { startNotificationWorker, stopNotificationWorker } from './lib/notificationWorker.js'
import { healthRoutes }     from './routes/api/v1/health.js'
import { meRoutes }         from './routes/api/v1/me.js'
import { ingredientRoutes } from './routes/api/v1/ingredients.js'
import { batchRoutes }      from './routes/api/v1/batches.js'
import { marketRoutes }     from './routes/api/v1/market.js'

const app = Fastify({ logger: true })

// ── Routes ────────────────────────────────────────────────────────────────────
await app.register(healthRoutes,     { prefix: '/api/v1' })
await app.register(meRoutes,         { prefix: '/api/v1' })
await app.register(ingredientRoutes, { prefix: '/api/v1' })
await app.register(batchRoutes,      { prefix: '/api/v1' })
await app.register(marketRoutes,     { prefix: '/api/v1' })

// ── Уведомления: воркер готовности партий ─────────────────────────────────────
startNotificationWorker()

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async () => {
  stopNotificationWorker()
  await prisma.$disconnect()
  await closeRedis()
  process.exit(0)
}
process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)

// ── Start ─────────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error(error)
  await prisma.$disconnect()
  await closeRedis()
  process.exit(1)
}
