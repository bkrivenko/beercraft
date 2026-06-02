import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../../middleware/auth.js'
import { getOrCreateUser } from '../../../services/user.service.js'

export async function meRoutes(app: FastifyInstance) {
  // GET /api/v1/me — профиль текущего пользователя (создаётся при первом входе)
  app.get(
    '/me',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const profile = await getOrCreateUser(request.telegramUser)
        return reply.code(200).send(profile)
      } catch (err) {
        request.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )
}
