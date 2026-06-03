/**
 * In-memory хранилище лобби дуэлей.
 *
 * Одна комната = один матч в статусе 'lobby'.
 * При рестарте сервера комнаты сбрасываются; активные матчи
 * (status='in_progress') персистируются в БД.
 *
 * Масштабирование: при нескольких инстансах заменить Map на Redis hash/pub-sub.
 */

import type { WebSocket } from '@fastify/websocket'

// ── Типы ──────────────────────────────────────────────────────────────────────

export type RoomStatus = 'lobby' | 'in_progress' | 'finished'

export interface RoomPlayer {
  userId:      bigint
  displayName: string
  isReady:     boolean
  ws:          WebSocket
}

export interface DuelTask {
  styleKey:  string
  styleName: string
  budgetSoft: number   // максимальный бюджет на ингредиенты
  timeSec:   number    // время на варку (мини-игру)
}

export interface Room {
  id:        string          // invite-код (6 символов)
  matchId:   bigint | null   // заполняется после записи в БД
  hostId:    bigint
  players:   Map<bigint, RoomPlayer>
  status:    RoomStatus
  seed:      bigint
  task:      DuelTask | null
  createdAt: Date
  maxPlayers: number
}

// ── Store ─────────────────────────────────────────────────────────────────────

const rooms = new Map<string, Room>()

// ── Генерация invite-кода ─────────────────────────────────────────────────────

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // без похожих символов

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)]
}

export function makeRoomCode(): string {
  let code = Array.from({ length: 6 }, randomChar).join('')
  while (rooms.has(code)) code = Array.from({ length: 6 }, randomChar).join('')
  return code
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function createRoom(hostId: bigint, displayName: string, ws: WebSocket): Room {
  const code = makeRoomCode()
  const room: Room = {
    id:         code,
    matchId:    null,
    hostId,
    players:    new Map([[hostId, { userId: hostId, displayName, isReady: false, ws }]]),
    status:     'lobby',
    seed:       BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
    task:       null,
    createdAt:  new Date(),
    maxPlayers: 2,
  }
  rooms.set(code, room)
  return room
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase())
}

export function getRoomByUser(userId: bigint): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(userId)) return room
  }
  return undefined
}

export function deleteRoom(code: string): void {
  rooms.delete(code)
}

/** Удаляем старые пустые комнаты (> 30 мин без активности) */
export function pruneStaleRooms(): void {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [code, room] of rooms) {
    if (room.createdAt.getTime() < cutoff && room.players.size === 0) {
      rooms.delete(code)
    }
  }
}

export function getRoomCount(): number {
  return rooms.size
}
