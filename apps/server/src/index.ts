import 'dotenv/config'
import Fastify from 'fastify'
import { prisma } from './db/client.js'
import { healthRoutes } from './routes/api/v1/health.js'
import { meRoutes } from './routes/api/v1/me.js'
import { ingredientRoutes } from './routes/api/v1/ingredients.js'

const app = Fastify({ logger: true })

// Graceful shutdown — закрываем Prisma при остановке
const shutdown = async () => {
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Routes
await app.register(healthRoutes, { prefix: '/api/v1' })
await app.register(meRoutes, { prefix: '/api/v1' })
await app.register(ingredientRoutes, { prefix: '/api/v1' })

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error(error)
  await prisma.$disconnect()
  process.exit(1)
}
