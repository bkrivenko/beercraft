/**
 * Экран «Дуэль» — Э-7
 * Фазы: lobby → task → waiting → results
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTelegram } from '../telegram/useTelegram'
import { useMatchWs, type LobbyState, type DuelTask } from '../lib/useMatchWs'
import { api } from '../lib/api'

// ── Компоненты ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-brown-800 rounded-xl ${className ?? ''}`} />
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-4 my-3 bg-red-950 border border-red-800 rounded-xl px-4 py-3 flex items-center justify-between">
      <p className="text-red-300 text-sm flex-1">{message}</p>
      {onRetry && (
        <button
          className="ml-3 text-red-400 text-xs font-semibold underline"
          onClick={onRetry}
        >
          Повторить
        </button>
      )}
    </div>
  )
}

// ── Фаза: Лобби ───────────────────────────────────────────────────────────────

function LobbyPhase({
  state,
  onConnect,
  onCreateRoom,
  onJoinRoom,
  onSetReady,
  onLeave,
}: {
  state:        LobbyState
  onConnect:    () => void
  onCreateRoom: () => void
  onJoinRoom:   (code: string) => void
  onSetReady:   (r: boolean) => void
  onLeave:      () => void
}) {
  const [joinCode, setJoinCode]   = useState('')
  const [myReady, setMyReady]     = useState(false)
  const { initData }              = useTelegram()
  const userId                    = useRef<string | null>(null)

  // Определяем свой userId из initData (Telegram передаёт в user.id)
  useEffect(() => {
    try {
      const params = new URLSearchParams(initData)
      const user   = JSON.parse(params.get('user') ?? '{}')
      userId.current = String(user.id ?? '')
    } catch { /* ignore */ }
  }, [initData])

  const myPlayer = state.players.find((p) => p.userId === userId.current)
  const isInRoom = !!state.roomCode

  function handleReady() {
    const next = !myReady
    setMyReady(next)
    onSetReady(next)
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code.length === 6) onJoinRoom(code)
  }

  if (state.status === 'disconnected' || state.status === 'error') {
    return (
      <div className="flex flex-col items-center py-12 space-y-4 px-4">
        <span className="text-6xl">⚔️</span>
        <h2 className="text-cream-100 font-bold text-lg">Дуэль пивоваров</h2>
        <p className="text-cream-200 text-sm opacity-60 text-center">
          Сразитесь с другим пивоваром — кто сварит лучшее пиво?
        </p>
        {state.error && <ErrorBanner message={state.error} />}
        <button
          className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
          onClick={onConnect}
        >
          Подключиться к лобби
        </button>
      </div>
    )
  }

  if (state.status === 'connecting') {
    return (
      <div className="flex flex-col items-center py-16 space-y-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <p className="text-cream-200 text-sm opacity-60">Подключение…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col pb-32">
      {/* Заголовок */}
      <div className="bg-brown-900 border-b border-brown-800 px-4 py-4">
        <h1 className="text-cream-100 font-bold text-lg flex items-center gap-2">
          <span>⚔️</span> Дуэль 1×1
        </h1>
        <p className="text-cream-200 text-xs opacity-50 mt-0.5">
          Лобби — {state.players.length} / 2 игрока
        </p>
      </div>

      {/* Действия */}
      {!isInRoom && (
        <div className="px-4 pt-4 space-y-3">
          <button
            className="w-full bg-amber-600 text-brown-950 font-bold py-3 rounded-xl active:opacity-80"
            onClick={onCreateRoom}
          >
            ⚔️ Создать комнату
          </button>

          <div className="flex gap-2">
            <input
              className="flex-1 bg-brown-800 border border-brown-700 text-cream-100 placeholder-cream-200/40 rounded-xl px-3 py-3 text-sm uppercase tracking-widest focus:outline-none focus:border-amber-600"
              placeholder="Код комнаты"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button
              className="bg-brown-700 text-cream-100 font-semibold px-4 rounded-xl active:opacity-70 disabled:opacity-40"
              disabled={joinCode.trim().length < 6}
              onClick={handleJoin}
            >
              Войти
            </button>
          </div>
        </div>
      )}

      {/* Комната */}
      {isInRoom && (
        <div className="px-4 pt-4 space-y-3">
          {/* Код комнаты + invite */}
          <div className="bg-brown-900 border border-brown-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-cream-200 text-xs opacity-50">Код комнаты</p>
              <p className="text-cream-100 font-mono font-bold text-xl tracking-widest">
                {state.roomCode}
              </p>
            </div>
            {state.inviteUrl && (
              <button
                className="bg-amber-700/30 text-amber-400 text-xs font-semibold px-3 py-2 rounded-lg active:opacity-70"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ url: state.inviteUrl!, title: '⚔️ Дуэль в BeerCraft' })
                  } else {
                    navigator.clipboard.writeText(state.inviteUrl!)
                  }
                }}
              >
                📤 Поделиться
              </button>
            )}
          </div>

          {/* Список игроков */}
          <div className="space-y-2">
            {state.players.map((p) => (
              <div
                key={p.userId}
                className="bg-brown-800 border border-brown-700 rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.isHost ? '👑' : '🍺'}</span>
                  <div>
                    <p className="text-cream-100 font-semibold text-sm">{p.displayName}</p>
                    {p.isHost && (
                      <p className="text-amber-400 text-xs opacity-70">Хост</p>
                    )}
                  </div>
                </div>
                <span className={`text-lg ${p.isReady ? 'opacity-100' : 'opacity-30'}`}>
                  {p.isReady ? '✅' : '⬜'}
                </span>
              </div>
            ))}

            {/* Заглушка для второго игрока */}
            {state.players.length < 2 && (
              <div className="bg-brown-800/50 border border-brown-700/50 border-dashed rounded-xl px-4 py-3 flex items-center gap-2 opacity-50">
                <span className="text-xl">👤</span>
                <p className="text-cream-200 text-sm">Ожидание соперника…</p>
              </div>
            )}
          </div>

          {/* Готов / выход */}
          <div className="space-y-2">
            <button
              className={`w-full font-bold py-3.5 rounded-2xl text-base active:opacity-80 ${
                myReady
                  ? 'bg-hop-700 text-cream-100'
                  : 'bg-amber-600 text-brown-950'
              }`}
              onClick={handleReady}
            >
              {myReady ? '✅ Готов — ждём соперника' : '⚔️ Готов к дуэли'}
            </button>
            <button
              className="w-full bg-transparent border border-brown-700 text-cream-200 text-sm py-2.5 rounded-xl active:opacity-70"
              onClick={onLeave}
            >
              Покинуть комнату
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Фаза: Задание ─────────────────────────────────────────────────────────────

function TaskPhase({
  task,
  players,
  onStartBrew,
}: {
  task:        DuelTask
  players:     LobbyState['players']
  onStartBrew: () => void
}) {
  return (
    <div className="flex flex-col pb-32">
      <div className="bg-brown-900 border-b border-brown-800 px-4 py-4">
        <h1 className="text-cream-100 font-bold text-lg">⚔️ Задание дуэли</h1>
        <p className="text-cream-200 text-xs opacity-50 mt-0.5">Оба игрока получили одинаковое задание</p>
      </div>

      <div className="px-4 pt-6 space-y-4">
        {/* Стиль */}
        <div className="bg-hop-900 border border-hop-700 rounded-2xl px-5 py-5 text-center">
          <p className="text-hop-400 text-xs font-semibold uppercase tracking-wider mb-1">Стиль пива</p>
          <p className="text-cream-100 font-bold text-2xl">{task.styleName}</p>
          <p className="text-cream-200 text-xs opacity-50 mt-1">{task.styleKey}</p>
        </div>

        {/* Параметры */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-brown-900 border border-brown-800 rounded-xl px-4 py-4 text-center">
            <p className="text-amber-400 text-xs font-semibold opacity-70 mb-1">Бюджет</p>
            <p className="text-cream-100 font-bold text-lg">💰 {task.budgetSoft}</p>
          </div>
          <div className="bg-brown-900 border border-brown-800 rounded-xl px-4 py-4 text-center">
            <p className="text-amber-400 text-xs font-semibold opacity-70 mb-1">Время</p>
            <p className="text-cream-100 font-bold text-lg">⏱ {Math.floor(task.timeSec / 60)} мин</p>
          </div>
        </div>

        {/* Игроки */}
        <div className="bg-brown-900 border border-brown-800 rounded-xl px-4 py-3">
          <p className="text-cream-200 text-xs opacity-50 mb-2">Участники</p>
          <div className="flex items-center justify-around">
            {players.map((p) => (
              <div key={p.userId} className="text-center">
                <p className="text-2xl">{p.isHost ? '👑' : '🍺'}</p>
                <p className="text-cream-100 text-sm font-semibold mt-1">{p.displayName}</p>
              </div>
            ))}
            {players.length === 2 && (
              <p className="text-cream-200 text-lg opacity-40">VS</p>
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-4 bg-gradient-to-t from-brown-950 via-brown-950/90 to-transparent">
        <button
          className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
          onClick={onStartBrew}
        >
          🍺 Начать варку
        </button>
      </div>
    </div>
  )
}

// ── Фаза: Ожидание результатов соперника ─────────────────────────────────────

interface MatchResult {
  matchId:        string
  status:         string
  myScore:        number | null
  myResult:       string | null
  opponentName:   string | null
  opponentScore:  number | null
  eloDelta?:      number | null
}

function WaitingPhase({ matchId }: { matchId: string }) {
  const [result, setResult] = useState<MatchResult | null>(null)
  const [loading, setLoading] = useState(true)

  const poll = useCallback(async () => {
    try {
      const data = await (api as any).getMatch(matchId)
      if (data.status === 'finished') {
        setResult(data)
        setLoading(false)
      }
    } catch { /* retry next tick */ }
  }, [matchId])

  useEffect(() => {
    const t = setInterval(poll, 3000)
    poll()
    return () => clearInterval(t)
  }, [poll])

  if (loading || !result) {
    return (
      <div className="flex flex-col items-center py-16 space-y-4 px-4">
        <div className="text-5xl animate-bounce">⏳</div>
        <p className="text-cream-100 font-bold text-lg">Ожидаем соперника…</p>
        <p className="text-cream-200 text-sm opacity-60 text-center">
          Соперник ещё варит. Мы пришлём уведомление, когда результат будет готов.
        </p>
        <Skeleton className="h-4 w-48 mt-4" />
      </div>
    )
  }

  return <ResultsPhase result={result} />
}

// ── Фаза: Результаты ─────────────────────────────────────────────────────────

function ResultsPhase({ result }: { result: MatchResult }) {
  const isWin  = result.myResult === 'win'
  const isDraw = result.myResult === 'draw'

  return (
    <div className="flex flex-col pb-32">
      {/* Шапка */}
      <div
        className={`px-4 py-6 text-center ${
          isWin  ? 'bg-hop-900 border-b border-hop-700' :
          isDraw ? 'bg-brown-900 border-b border-brown-800' :
                   'bg-red-950 border-b border-red-900'
        }`}
      >
        <p className="text-4xl mb-2">
          {isWin ? '🏆' : isDraw ? '🤝' : '😔'}
        </p>
        <h1 className={`font-bold text-2xl ${
          isWin  ? 'text-hop-300' :
          isDraw ? 'text-cream-100' :
                   'text-red-300'
        }`}>
          {isWin ? 'Победа!' : isDraw ? 'Ничья!' : 'Поражение'}
        </h1>
        {result.eloDelta != null && (
          <p className={`text-sm mt-1 font-semibold ${result.eloDelta >= 0 ? 'text-hop-400' : 'text-red-400'}`}>
            {result.eloDelta >= 0 ? '+' : ''}{result.eloDelta} рейтинг
          </p>
        )}
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Сравнение очков */}
        <div className="bg-brown-900 border border-brown-800 rounded-2xl px-4 py-5">
          <p className="text-cream-200 text-xs opacity-50 uppercase tracking-wider mb-4 text-center">
            Сравнение
          </p>
          <div className="grid grid-cols-3 gap-2 items-center">
            {/* Мой результат */}
            <div className="text-center">
              <p className="text-cream-200 text-xs opacity-60 mb-1">Вы</p>
              <div className={`rounded-xl py-3 ${isWin ? 'bg-hop-800/50' : 'bg-brown-800'}`}>
                <p className={`font-bold text-2xl ${isWin ? 'text-hop-300' : 'text-cream-100'}`}>
                  {result.myScore ?? '—'}
                </p>
                <p className="text-cream-200 text-xs opacity-50">качество</p>
              </div>
            </div>

            {/* VS */}
            <p className="text-center text-cream-200 text-sm opacity-40 font-bold">VS</p>

            {/* Соперник */}
            <div className="text-center">
              <p className="text-cream-200 text-xs opacity-60 mb-1">
                {result.opponentName ?? 'Соперник'}
              </p>
              <div className={`rounded-xl py-3 ${!isWin && !isDraw ? 'bg-hop-800/50' : 'bg-brown-800'}`}>
                <p className={`font-bold text-2xl ${!isWin && !isDraw ? 'text-hop-300' : 'text-cream-100'}`}>
                  {result.opponentScore ?? '—'}
                </p>
                <p className="text-cream-200 text-xs opacity-50">качество</p>
              </div>
            </div>
          </div>
        </div>

        {/* История матча */}
        <div className="bg-brown-900 border border-brown-800 rounded-xl px-4 py-3">
          <p className="text-cream-200 text-xs opacity-50">Матч #{result.matchId.slice(-6)}</p>
          <p className={`text-sm font-semibold mt-1 ${
            isWin ? 'text-hop-400' : isDraw ? 'text-amber-400' : 'text-red-400'
          }`}>
            {isWin ? '🏆 Победа' : isDraw ? '🤝 Ничья' : '😔 Поражение'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────

type Phase = 'lobby' | 'task' | 'waiting' | 'results'

interface DuelScreenProps {
  onStartBrew?: (matchId: string, task: DuelTask) => void
}

export function DuelScreen({ onStartBrew }: DuelScreenProps) {
  const { state, connect, createRoom, joinRoom, setReady, leaveRoom } = useMatchWs()
  const [phase, setPhase] = useState<Phase>('lobby')
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)

  // Когда матч стартует — переходим к фазе задания
  useEffect(() => {
    if (state.status === 'starting' && state.matchId && state.task) {
      setPhase('task')
    }
  }, [state.status, state.matchId, state.task])

  function handleStartBrew() {
    if (!state.matchId || !state.task) return
    if (onStartBrew) {
      onStartBrew(state.matchId, state.task)
    } else {
      // Без полноценной мини-игры — переходим в ожидание
      setPhase('waiting')
    }
  }

  function handleLeave() {
    leaveRoom()
    setPhase('lobby')
    setMatchResult(null)
  }

  return (
    <div className="min-h-screen bg-brown-950">
      {phase === 'lobby' && (
        <LobbyPhase
          state={state}
          onConnect={connect}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onSetReady={setReady}
          onLeave={handleLeave}
        />
      )}

      {phase === 'task' && state.task && (
        <TaskPhase
          task={state.task}
          players={state.players}
          onStartBrew={handleStartBrew}
        />
      )}

      {phase === 'waiting' && state.matchId && (
        <WaitingPhase matchId={state.matchId} />
      )}

      {phase === 'results' && matchResult && (
        <ResultsPhase result={matchResult} />
      )}

      {/* Кнопка «Новая дуэль» на экране ожидания/результатов */}
      {(phase === 'waiting' || phase === 'results') && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-4 bg-gradient-to-t from-brown-950 via-brown-950/90 to-transparent">
          <button
            className="w-full bg-brown-800 border border-brown-700 text-cream-200 font-semibold py-3 rounded-2xl active:opacity-80"
            onClick={handleLeave}
          >
            ← В лобби
          </button>
        </div>
      )}
    </div>
  )
}
