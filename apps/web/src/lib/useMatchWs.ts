/**
 * Хук для WebSocket-лобби дуэли.
 * Управляет соединением, переотправкой при реконнекте, состоянием комнаты.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTelegram } from '../telegram/useTelegram'

const WS_URL = import.meta.env.VITE_WS_URL ?? window.location.origin.replace(/^http/, 'ws')

// ── Типы (зеркало server wsProtocol.ts) ──────────────────────────────────────

export interface PlayerInfo {
  userId:      string
  displayName: string
  isReady:     boolean
  isHost:      boolean
}

export interface DuelTask {
  styleKey:   string
  styleName:  string
  budgetSoft: number
  timeSec:    number
}

export type LobbyStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'    // в комнате
  | 'starting'     // match_starting получен
  | 'error'

export interface LobbyState {
  status:    LobbyStatus
  roomCode:  string | null
  inviteUrl: string | null
  players:   PlayerInfo[]
  matchId:   string | null
  seed:      string | null
  task:      DuelTask | null
  error:     string | null
}

// ── Хук ───────────────────────────────────────────────────────────────────────

export function useMatchWs() {
  const { initData } = useTelegram()
  const wsRef        = useRef<WebSocket | null>(null)
  const pingRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  const [state, setState] = useState<LobbyState>({
    status:    'disconnected',
    roomCode:  null,
    inviteUrl: null,
    players:   [],
    matchId:   null,
    seed:      null,
    task:      null,
    error:     null,
  })

  // ── Отправка сообщений ──────────────────────────────────────────────────────
  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // ── Подключение ─────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setState((s) => ({ ...s, status: 'connecting', error: null }))

    const url = `${WS_URL}/ws/match?initData=${encodeURIComponent(initData)}`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      // Keepalive ping каждые 25с
      pingRef.current = setInterval(() => send({ type: 'ping' }), 25_000)
    }

    ws.onmessage = (evt) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(evt.data) } catch { return }

      switch (msg.type) {
        case 'pong':
          break

        case 'room_created':
          setState((s) => ({
            ...s,
            status:    'connected',
            roomCode:  msg.code as string,
            inviteUrl: msg.inviteUrl as string,
            players:   msg.players as PlayerInfo[],
          }))
          break

        case 'room_joined':
          setState((s) => ({
            ...s,
            status:   'connected',
            roomCode: msg.code as string,
            players:  msg.players as PlayerInfo[],
          }))
          break

        case 'player_joined':
          setState((s) => ({
            ...s,
            players: [...s.players.filter((p) => p.userId !== (msg.player as PlayerInfo).userId), msg.player as PlayerInfo],
          }))
          break

        case 'player_left':
          setState((s) => ({ ...s, players: msg.players as PlayerInfo[] }))
          break

        case 'ready_changed':
          setState((s) => ({ ...s, players: msg.players as PlayerInfo[] }))
          break

        case 'match_starting':
          setState((s) => ({
            ...s,
            status:  'starting',
            matchId: msg.matchId as string,
            seed:    msg.seed as string,
            task:    msg.task as DuelTask,
            players: msg.players as PlayerInfo[],
          }))
          break

        case 'error':
          setState((s) => ({
            ...s,
            status: 'error',
            error:  msg.message as string,
          }))
          break
      }
    }

    ws.onclose = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      setState((s) => ({
        ...s,
        status: s.status === 'starting' ? 'starting' : 'disconnected',
      }))
    }

    ws.onerror = () => {
      setState((s) => ({
        ...s,
        status: 'error',
        error:  'Ошибка подключения к серверу',
      }))
    }
  }, [initData, send])

  // ── Действия ────────────────────────────────────────────────────────────────
  const createRoom  = useCallback(() => send({ type: 'create_room' }), [send])
  const joinRoom    = useCallback((code: string) => send({ type: 'join_room', code }), [send])
  const setReady    = useCallback((ready: boolean) => send({ type: 'set_ready', ready }), [send])
  const leaveRoom   = useCallback(() => {
    send({ type: 'leave_room' })
    setState((s) => ({
      ...s, status: 'disconnected', roomCode: null, inviteUrl: null, players: [],
    }))
  }, [send])

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pingRef.current) clearInterval(pingRef.current)
      wsRef.current?.close()
    }
  }, [])

  return { state, connect, createRoom, joinRoom, setReady, leaveRoom }
}
