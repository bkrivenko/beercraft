import 'dotenv/config'
import Fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import { prisma }                    from './db/client.js'
import { closeRedis }                from './lib/redis.js'
import { startBot, stopBot }         from './lib/bot.js'
import { startNotificationWorker, stopNotificationWorker } from './lib/notificationWorker.js'
import { healthRoutes }              from './routes/api/v1/health.js'
import { meRoutes }                  from './routes/api/v1/me.js'
import { ingredientRoutes }          from './routes/api/v1/ingredients.js'
import { batchRoutes }               from './routes/api/v1/batches.js'
import { marketRoutes }              from './routes/api/v1/market.js'
import { matchRoutes }               from './routes/api/v1/match.js'
import { duelRoutes }                from './routes/api/v1/duel.js'
import { webhookRoutes }             from './routes/webhook.js'
import { matchWsRoutes }             from './routes/ws/match.js'
import { cancelStaleMatches }        from './services/match.service.js'

const app = Fastify({ logger: true })

// ── Плагины ───────────────────────────────────────────────────────────────────
await app.register(fastifyWebsocket)

// ── REST Routes ───────────────────────────────────────────────────────────────
await app.register(healthRoutes,     { prefix: '/api/v1' })
await app.register(meRoutes,         { prefix: '/api/v1' })
await app.register(ingredientRoutes, { prefix: '/api/v1' })
await app.register(batchRoutes,      { prefix: '/api/v1' })
await app.register(marketRoutes,     { prefix: '/api/v1' })
await app.register(matchRoutes,      { prefix: '/api/v1' })
await app.register(duelRoutes,       { prefix: '/api/v1' })

// ── WebSocket Routes ──────────────────────────────────────────────────────────
await app.register(matchWsRoutes)

// ── Telegram Webhook ──────────────────────────────────────────────────────────
await app.register(webhookRoutes)

// ── Фоновые воркеры ───────────────────────────────────────────────────────────
startNotificationWorker()
setInterval(() => { void cancelStaleMatches() }, 5 * 60 * 1000)

// ── Запуск бота ───────────────────────────────────────────────────────────────
await startBot()

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async () => {
  stopNotificationWorker()
  await stopBot()
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
