import Fastify from 'fastify'
import { healthRoutes } from './routes/api/v1/health.js'

const app = Fastify({ logger: true })

// API v1
await app.register(healthRoutes, { prefix: '/api/v1' })

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
