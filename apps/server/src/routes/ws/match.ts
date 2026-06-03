/**
 * WebSocket-лобби для дуэлей — /ws/match
 *
 * Аутентификация: ?initData=<urlencoded Telegram initData> в query-параметре.
 * После подключения клиент шлёт JSON-сообщения (ClientMsg).
 *
 * Жизненный цикл комнаты:
 *   create_room → room_created (code + inviteUrl)
 *       ↓ join_room(code)
 *   player_joined → все видят обновлённый список
 *       ↓ set_ready(true) от всех игроков
 *   match_starting → seed + task → все переходят на экран варки
 */

import type { FastifyInstance } from 'fastify'
import type { WebSocket }       from '@fastify/websocket'
import { prisma }               from '../../db/client.js'
import { validateInitData }     from '../../middleware/auth.js'
import {
  createRoom, getRoom, getRoomByUser, deleteRoom, pruneStaleRooms,
  type Room, type RoomPlayer,
} from '../../lib/lobbyStore.js'
import { send, broadcast, parseClientMsg, type PlayerInfo } from '../../lib/wsProtocol.js'
import { pickTaskBySeed } from '../../game/duelTasks.js'

// ── Хелперы ───────────────────────────────────────────────────────────────────

function makePlayers(room: Room): PlayerInfo[] {
  return Array.from(room.players.values()).map((p) => ({
    userId:      p.userId.toString(),
    displayName: p.displayName,
    isReady:     p.isReady,
    isHost:      p.userId === room.hostId,
  }))
}

function inviteUrl(code: string): string {
  const base = process.env.APP_URL ?? 'https://t.me/your_bot'
  return `${base}?startapp=duel_${code}`
}

/** Рассылает всем игрокам кроме одного */
function broadcastExcept(room: Room, excludeId: bigint, msg: Parameters<typeof broadcast>[1]) {
  const sockets = Array.from(room.players.values())
    .filter((p) => p.userId !== excludeId)
    .map((p) => p.ws)
  broadcast(sockets, msg)
}

// ── Стартует матч — записывает в БД и рассылает seed+task ────────────────────

async function startMatch(room: Room): Promise<void> {
  const task = pickTaskBySeed(room.seed)
  room.task  = task
  room.status = 'in_progress'

  // Находим userId всех игроков
  const userIds = Array.from(room.players.keys())

  // Сохраняем матч в БД
  const match = await (prisma as any).match.create({
    data: {
      mode:   'duel',
      seed:   room.seed,
      status: 'in_progress',
      task:   {
        styleKey:   task.styleKey,
        styleName:  task.styleName,
        budgetSoft: task.budgetSoft,
        timeSec:    task.timeSec,
      },
      participants: {
        create: userIds.map((uid) => ({
          user_id:  uid,
          is_ready: true,
          result:   'pending',
        })),
      },
    },
  })

  room.matchId = match.id

  // Рассылаем старт всем
  const players = makePlayers(room)
  const allSockets = Array.from(room.players.values()).map((p) => p.ws)
  broadcast(allSockets, {
    type:    'match_starting',
    matchId: match.id.toString(),
    seed:    room.seed.toString(),
    task:    {
      styleKey:   task.styleKey,
      styleName:  task.styleName,
      budgetSoft: task.budgetSoft,
      timeSec:    task.timeSec,
    },
    players,
  })
}

// ── Обработка разрыва соединения ──────────────────────────────────────────────

function handleDisconnect(room: Room, userId: bigint): void {
  room.players.delete(userId)

  if (room.players.size === 0) {
    deleteRoom(room.id)
    return
  }

  // Если хост ушёл — назначаем нового
  if (room.hostId === userId) {
    room.hostId = room.players.keys().next().value!
  }

  const allSockets = Array.from(room.players.values()).map((p) => p.ws)
  broadcast(allSockets, {
    type:    'player_left',
    userId:  userId.toString(),
    players: makePlayers(room),
  })
}

// ── Обработчик одного соединения ──────────────────────────────────────────────

async function handleConnection(ws: WebSocket, userId: bigint, displayName: string): Promise<void> {
  // Если игрок уже в комнате (реконнект) — восстанавливаем
  let room = getRoomByUser(userId)
  if (room) {
    const player = room.players.get(userId)
    if (player) player.ws = ws
    send(ws, { type: 'room_joined', code: room.id, players: makePlayers(room) })
  }

  ws.on('message', async (raw: Buffer | string) => {
    const msg = parseClientMsg(raw.toString())
    if (!msg) return

    switch (msg.type) {

      case 'ping':
        send(ws, { type: 'pong' })
        break

      // ── Создать комнату ────────────────────────────────────────────────────
      case 'create_room': {
        // Выходим из старой комнаты если была
        const old = getRoomByUser(userId)
        if (old) handleDisconnect(old, userId)

        room = createRoom(userId, displayName, ws)
        send(ws, {
          type:      'room_created',
          code:      room.id,
          inviteUrl: inviteUrl(room.id),
          players:   makePlayers(room),
        })
        break
      }

      // ── Войти в комнату по коду ────────────────────────────────────────────
      case 'join_room': {
        const code = msg.code?.trim().toUpperCase()
        if (!code) {
          send(ws, { type: 'error', code: 'INVALID_CODE', message: 'Укажите код комнаты' })
          break
        }

        const target = getRoom(code)
        if (!target) {
          send(ws, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Комната не найдена' })
          break
        }
        if (target.status !== 'lobby') {
          send(ws, { type: 'error', code: 'ROOM_STARTED', message: 'Матч уже начался' })
          break
        }
        if (target.players.size >= target.maxPlayers && !target.players.has(userId)) {
          send(ws, { type: 'error', code: 'ROOM_FULL', message: 'Комната заполнена' })
          break
        }

        // Выходим из старой комнаты
        const old = getRoomByUser(userId)
        if (old && old.id !== code) handleDisconnect(old, userId)

        // Добавляем в новую
        if (!target.players.has(userId)) {
          const newPlayer: RoomPlayer = { userId, displayName, isReady: false, ws }
          target.players.set(userId, newPlayer)

          // Уведомляем остальных
          broadcastExcept(target, userId, {
            type:   'player_joined',
            player: { userId: userId.toString(), displayName, isReady: false, isHost: false },
          })
        } else {
          // Реконнект
          target.players.get(userId)!.ws = ws
        }

        room = target
        send(ws, { type: 'room_joined', code: target.id, players: makePlayers(target) })
        break
      }

      // ── Изменить статус готовности ─────────────────────────────────────────
      case 'set_ready': {
        if (!room) {
          send(ws, { type: 'error', code: 'NOT_IN_ROOM', message: 'Вы не в комнате' })
          break
        }
        if (room.status !== 'lobby') break

        const player = room.players.get(userId)
        if (!player) break

        player.isReady = msg.ready ?? true
        const players  = makePlayers(room)

        const allSockets = Array.from(room.players.values()).map((p) => p.ws)
        broadcast(allSockets, {
          type:    'ready_changed',
          userId:  userId.toString(),
          isReady: player.isReady,
          players,
        })

        // Запускаем матч если все готовы и >= 2 игроков
        const allReady    = Array.from(room.players.values()).every((p) => p.isReady)
        const enoughPlayers = room.players.size >= 2

        if (allReady && enoughPlayers) {
          await startMatch(room)
        }
        break
      }

      // ── Покинуть комнату ───────────────────────────────────────────────────
      case 'leave_room': {
        if (room) {
          handleDisconnect(room, userId)
          room = undefined
        }
        break
      }
    }
  })

  ws.on('close', () => {
    if (room) handleDisconnect(room, userId)
  })

  ws.on('error', () => {
    if (room) handleDisconnect(room, userId)
  })
}

// ── Fastify-плагин ────────────────────────────────────────────────────────────

export async function matchWsRoutes(app: FastifyInstance): Promise<void> {
  // Чистка старых комнат каждые 10 мин
  setInterval(pruneStaleRooms, 10 * 60 * 1000)

  app.get(
    '/ws/match',
    { websocket: true },
    async (socket, request) => {
      // ── Аутентификация по query-параметру ──────────────────────────────────
      const { initData } = request.query as { initData?: string }
      const botToken     = process.env.BOT_TOKEN

      if (!botToken || !initData) {
        send(socket, { type: 'error', code: 'UNAUTHORIZED', message: 'Требуется авторизация' })
        socket.close(1008, 'Unauthorized')
        return
      }

      let tgUser: Awaited<ReturnType<typeof validateInitData>> | null = null
      try {
        tgUser = validateInitData(decodeURIComponent(initData), botToken)
      } catch {
        send(socket, { type: 'error', code: 'INVALID_AUTH', message: 'Неверный initData' })
        socket.close(1008, 'Unauthorized')
        return
      }

      // ── Получаем / создаём пользователя ────────────────────────────────────
      const dbUser = await (prisma as any).user.findUnique({
        where:  { telegram_id: BigInt(tgUser.id) },
        select: { id: true, display_name: true },
      })

      if (!dbUser) {
        send(socket, { type: 'error', code: 'USER_NOT_FOUND', message: 'Сначала войдите в игру' })
        socket.close(1008, 'User not found')
        return
      }

      const displayName = dbUser.display_name
        ?? ([tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || `User${tgUser.id}`)

      await handleConnection(socket, dbUser.id, displayName)
    },
  )
}
