/**
 * Типизированный WS-протокол для дуэлей.
 *
 * Клиент → Сервер (ClientMsg)
 * Сервер → Клиент (ServerMsg)
 *
 * Все сообщения — JSON с полем `type`.
 */

// ── Клиент → Сервер ───────────────────────────────────────────────────────────

export type ClientMsg =
  | { type: 'create_room' }
  | { type: 'join_room';  code: string }
  | { type: 'set_ready';  ready: boolean }
  | { type: 'leave_room' }
  | { type: 'ping' }

// ── Сервер → Клиент ───────────────────────────────────────────────────────────

export interface PlayerInfo {
  userId:      string
  displayName: string
  isReady:     boolean
  isHost:      boolean
}

export type ServerMsg =
  | {
      type:       'room_created'
      code:       string
      inviteUrl:  string
      players:    PlayerInfo[]
    }
  | {
      type:    'room_joined'
      code:    string
      players: PlayerInfo[]
    }
  | {
      type:   'player_joined'
      player: PlayerInfo
    }
  | {
      type:    'player_left'
      userId:  string
      players: PlayerInfo[]
    }
  | {
      type:    'ready_changed'
      userId:  string
      isReady: boolean
      players: PlayerInfo[]
    }
  | {
      type:    'match_starting'
      matchId: string
      seed:    string   // BigInt сериализован как string
      task: {
        styleKey:   string
        styleName:  string
        budgetSoft: number
        timeSec:    number
      }
      players: PlayerInfo[]
    }
  | {
      type:    'error'
      code:    string
      message: string
    }
  | { type: 'pong' }

// ── Хелперы ───────────────────────────────────────────────────────────────────

export function send(ws: { send: (data: string) => void }, msg: ServerMsg): void {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
    // соединение уже закрыто
  }
}

export function broadcast(
  sockets: Iterable<{ send: (data: string) => void }>,
  msg: ServerMsg,
): void {
  const data = JSON.stringify(msg)
  for (const ws of sockets) {
    try { ws.send(data) } catch { /* skip closed */ }
  }
}

export function parseClientMsg(raw: string): ClientMsg | null {
  try {
    const msg = JSON.parse(raw)
    if (typeof msg?.type !== 'string') return null
    return msg as ClientMsg
  } catch {
    return null
  }
}
