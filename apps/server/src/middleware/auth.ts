import type { FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'node:crypto'

// Telegram initData validation per official docs:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export interface TelegramUser {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  language_code?: string
}

declare module 'fastify' {
  interface FastifyRequest {
    telegramUser: TelegramUser
  }
}

export function validateInitData(initData: string, botToken: string): TelegramUser {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) throw new Error('Missing hash in initData')

  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (expectedHash !== hash) throw new Error('Invalid initData signature')

  const userRaw = params.get('user')
  if (!userRaw) throw new Error('Missing user in initData')

  return JSON.parse(userRaw) as TelegramUser
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    reply.code(500).send({ error: 'BOT_TOKEN not configured' })
    return
  }

  const initData = request.headers['x-telegram-init-data'] as string | undefined
  if (!initData) {
    reply.code(401).send({ error: 'Missing Telegram initData' })
    return
  }

  try {
    request.telegramUser = validateInitData(initData, botToken)
  } catch {
    reply.code(401).send({ error: 'Invalid Telegram initData' })
  }
}
