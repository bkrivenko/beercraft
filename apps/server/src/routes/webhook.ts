/**
 * Telegram webhook endpoint — /webhook
 * Принимает апдейты от Telegram (в продакшн режиме).
 * В dev режиме бот использует polling, этот роут не нужен.
 */

import type { FastifyInstance } from 'fastify'
import { getBot } from '../lib/bot.js'
import { webhookCallback } from 'grammy'

export async function webhookRoutes(app: FastifyInstance) {
  const bot = getBot()
  if (!bot) return   // BOT_TOKEN не задан

  const secret = process.env.WEBHOOK_SECRET

  app.post(
    '/webhook',
    {
      config:  { rawBody: true },
      // Опциональная проверка secret token от Telegram
      ...(secret ? {
        preHandler: async (request: any, reply: any) => {
          const header = request.headers['x-telegram-bot-api-secret-token']
          if (header !== secret) {
            return reply.code(401).send({ error: 'Unauthorized' })
          }
        },
      } : {}),
    },
    webhookCallback(bot, 'fastify'),
  )
}
