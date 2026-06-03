import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../db/client.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    let dbStatus = 'unknown'
    let userCount: number | null = null
    try {
      userCount = await (prisma as any).user.count()
      dbStatus = 'ok'
    } catch (e) {
      dbStatus = e instanceof Error ? e.message : String(e)
    }
    return { status: 'ok', ts: new Date().toISOString(), db: dbStatus, userCount }
  })
}
