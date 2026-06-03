/**
 * Экран «Дуэль» — Э-7
 * Фазы: lobby → task → waiting → results
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTelegram } from '../telegram/useTelegram'
import { useMatchWs, type LobbyState, type DuelTask } from '../lib/useMatchWs'
import { srmToHex } from '../lib/brewCalc'
import { api } from '../lib/api'

// ── Утилиты ───────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-brown-800 rounded-xl ${className ?? ''}`} />
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-4 my-3 bg-red-950 border border-red-800 rounded-xl px-4 py-3 flex items-center justify-between">
      <p className="text-red-300 text-sm flex-1">{message}</p>
      {onRetry && (
        <button className="ml-3 text-red-400 text-xs font-semibold underline" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  )
}

// ── Типы API ──────────────────────────────────────────────────────────────────

interface MatchParticipant {
  userId:      string
  displayName: string
  result:      'win' | 'loss' | 'draw' | 'pending' | null
  score:       number | null
  batchId:     string | null
  batch: {
    quality: number | null
    abv:     number | null
    ibu:     number | null
    srm:     number | null
  } | null
}

interface MatchData {
  id:           string
  status:       string
  winnerId:     string | null
  task:         DuelTask | null
  participants: MatchParticipant[]
}

// ── DuelBeerCard — компактная карточка для экрана сравнения ──────────────────

function DuelBeerCard({
  participant,
  isMe,
  isWinner,
}: {
  participant: MatchParticipant
  isMe:        boolean
  isWinner:    boolean
}) {
  const b     = participant.batch
  const srm   = b?.srm ?? null
  const color = srm != null ? srmToHex(srm) : '#3b1e0a'

  const quality = b?.quality ?? participant.score ?? null

  const qualityColor =
    quality == null ? 'text-cream-200'
    : quality >= 85  ? 'text-hop-400'
    : quality >= 70  ? 'text-amber-400'
    : 'text-red-400'

  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden border transition-all ${
        isWinner
          ? 'border-amber-500 shadow-lg shadow-amber-900/30'
          : 'border-brown-700'
      }`}
    >
      {/* Цветовой блок пива */}
      <div
        className="h-24 flex items-center justify-center relative"
        style={{ background: color }}
      >
        <span className="text-4xl select-none drop-shadow">🍺</span>
        {isWinner && (
          <span className="absolute top-2 right-2 text-xl">🏆</span>
        )}
      </div>

      {/* Содержимое */}
      <div className="bg-brown-900 p-3 flex-1 space-y-2">
        {/* Имя */}
        <div>
          <p className={`text-xs font-semibold mb-0.5 ${isMe ? 'text-amber-400' : 'text-cream-200 opacity-50'}`}>
            {isMe ? 'Вы' : 'Соперник'}
          </p>
          <p className="text-cream-100 font-bold text-sm leading-tight truncate">
            {participant.displayName}
          </p>
        </div>

        {/* Качество — главная метрика */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-cream-200 text-xs opacity-60">Качество</span>
            <span className={`font-bold text-xl ${qualityColor}`}>
              {quality ?? '—'}
            </span>
          </div>
          {quality != null && (
            <div className="h-2 rounded-full bg-brown-800">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${
                  isWinner ? 'bg-amber-500' : 'bg-brown-600'
                }`}
                style={{ width: `${quality}%` }}
              />
            </div>
          )}
        </div>

        {/* ABV / IBU */}
        {(b?.abv != null || b?.ibu != null) && (
          <div className="flex gap-2 text-xs text-cream-200 opacity-70">
            {b?.abv != null && (
              <span>ABV <strong className="text-cream-100">{b.abv}%</strong></span>
            )}
            {b?.ibu != null && (
              <span>IBU <strong className="text-cream-100">{b.ibu}</strong></span>
            )}
          </div>
        )}

        {/* Ожидание — если партия ещё не сдана */}
        {!b && (
          <p className="text-cream-200 text-xs opacity-40 italic">Варит…</p>
        )}
      </div>
    </div>
  )
}

// ── Фаза: Лобби ───────────────────────────────────────────────────────────────

function LobbyPhase({
  state,
  myUserId,
  onConnect,
  onCreateRoom,
  onJoinRoom,
  onSetReady,
  onLeave,
}: {
  state:        LobbyState
  myUserId:     string | null
  onConnect:    () => void
  onCreateRoom: () => void
  onJoinRoom:   (code: string) => void
  onSetReady:   (r: boolean) => void
  onLeave:      () => void
}) {
  const [joinCode, setJoinCode] = useState('')
  const [myReady, setMyReady]   = useState(false)

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
      <div className="bg-brown-900 border-b border-brown-800 px-4 py-4">
        <h1 className="text-cream-100 font-bold text-lg flex items-center gap-2">
          <span>⚔️</span> Дуэль 1×1
        </h1>
        <p className="text-cream-200 text-xs opacity-50 mt-0.5">
          Лобби — {state.players.length} / 2 игрока
        </p>
      </div>

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

      {isInRoom && (
        <div className="px-4 pt-4 space-y-3">
          {/* Код + invite */}
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

          {/* Игроки */}
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
                    {p.isHost && <p className="text-amber-400 text-xs opacity-70">Хост</p>}
                  </div>
                </div>
                <span className={`text-lg ${p.isReady ? 'opacity-100' : 'opacity-30'}`}>
                  {p.isReady ? '✅' : '⬜'}
                </span>
              </div>
            ))}
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
                myReady ? 'bg-hop-700 text-cream-100' : 'bg-amber-600 text-brown-950'
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
        <p className="text-cream-200 text-xs opacity-50 mt-0.5">
          Оба игрока получили одинаковое задание
        </p>
      </div>

      <div className="px-4 pt-6 space-y-4">
        <div className="bg-hop-900 border border-hop-700 rounded-2xl px-5 py-5 text-center">
          <p className="text-hop-400 text-xs font-semibold uppercase tracking-wider mb-1">Стиль пива</p>
          <p className="text-cream-100 font-bold text-2xl">{task.styleName}</p>
          <p className="text-cream-200 text-xs opacity-50 mt-1">{task.styleKey}</p>
        </div>

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
              <p className="text-cream-200 text-lg opacity-40 font-bold">VS</p>
            )}
          </div>
        </div>
      </div>

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

// ── Фаза: Ожидание + поллинг ─────────────────────────────────────────────────

function WaitingPhase({
  matchId,
  myUserId,
  onResult,
}: {
  matchId:  string
  myUserId: string | null
  onResult: (data: MatchData) => void
}) {
  const [myParticipant, setMyParticipant] = useState<MatchParticipant | null>(null)

  const poll = useCallback(async () => {
    try {
      const data: MatchData = await api.getMatch(matchId)
      // Обновляем промежуточный статус «моей» карточки
      if (myUserId) {
        const me = data.participants.find((p) => p.userId === myUserId) ?? null
        setMyParticipant(me)
      }
      if (data.status === 'finished') onResult(data)
    } catch { /* retry */ }
  }, [matchId, myUserId, onResult])

  useEffect(() => {
    const t = setInterval(poll, 3000)
    poll()
    return () => clearInterval(t)
  }, [poll])

  return (
    <div className="flex flex-col pb-32">
      <div className="bg-brown-900 border-b border-brown-800 px-4 py-4">
        <h1 className="text-cream-100 font-bold text-lg">⏳ Ожидание соперника</h1>
        <p className="text-cream-200 text-xs opacity-50 mt-0.5">
          Соперник ещё варит — мы пришлём уведомление
        </p>
      </div>

      <div className="px-4 pt-6 flex flex-col items-center space-y-6">
        <div className="text-6xl animate-bounce">⏳</div>

        {/* Показываем свой результат если уже сдан */}
        {myParticipant?.batch && (
          <div className="w-full bg-brown-900 border border-brown-800 rounded-2xl px-5 py-4">
            <p className="text-cream-200 text-xs opacity-50 mb-2">Ваш результат принят</p>
            <div className="flex items-baseline gap-3">
              <span className="text-hop-400 font-bold text-3xl">
                {myParticipant.batch.quality ?? myParticipant.score ?? '—'}
              </span>
              <span className="text-cream-200 text-sm">качество</span>
            </div>
            {(myParticipant.batch.abv != null || myParticipant.batch.ibu != null) && (
              <div className="flex gap-3 text-xs text-cream-200 opacity-70 mt-2">
                {myParticipant.batch.abv != null && (
                  <span>ABV <strong className="text-cream-100">{myParticipant.batch.abv}%</strong></span>
                )}
                {myParticipant.batch.ibu != null && (
                  <span>IBU <strong className="text-cream-100">{myParticipant.batch.ibu}</strong></span>
                )}
              </div>
            )}
          </div>
        )}

        {!myParticipant?.batch && (
          <p className="text-cream-200 text-sm opacity-60 text-center px-4">
            Сдайте свою партию через «Забрать» → «Отправить в матч»
          </p>
        )}
      </div>
    </div>
  )
}

// ── Фаза: Результаты с двумя BeerCard ────────────────────────────────────────

function ResultsPhase({
  match,
  myUserId,
  onBack,
}: {
  match:    MatchData
  myUserId: string | null
  onBack:   () => void
}) {
  const me  = match.participants.find((p) => p.userId === myUserId) ?? match.participants[0]
  const opp = match.participants.find((p) => p.userId !== me?.userId) ?? match.participants[1]

  const myResult = me?.result ?? null
  const isWin    = myResult === 'win'
  const isDraw   = myResult === 'draw'

  const winnerBg =
    isWin  ? 'bg-hop-900 border-b border-hop-700'
    : isDraw ? 'bg-brown-900 border-b border-brown-800'
    : 'bg-red-950 border-b border-red-900'

  const outcomeLabel = isWin ? '🏆 Победа!' : isDraw ? '🤝 Ничья!' : '😔 Поражение'
  const outcomeCls   =
    isWin  ? 'text-hop-300'
    : isDraw ? 'text-cream-100'
    : 'text-red-300'

  return (
    <div className="flex flex-col pb-32">
      {/* Шапка с результатом */}
      <div className={`px-4 py-6 text-center ${winnerBg}`}>
        <p className="text-4xl mb-1">{isWin ? '🏆' : isDraw ? '🤝' : '😔'}</p>
        <h1 className={`font-bold text-2xl ${outcomeCls}`}>{outcomeLabel}</h1>
        {match.task && (
          <p className="text-cream-200 text-xs opacity-50 mt-1">
            Стиль: {match.task.styleName}
          </p>
        )}
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Две карточки рядом */}
        <div className="grid grid-cols-2 gap-3">
          {me  && (
            <DuelBeerCard
              participant={me}
              isMe
              isWinner={isWin}
            />
          )}
          {opp && (
            <DuelBeerCard
              participant={opp}
              isMe={false}
              isWinner={myResult === 'loss' || (!isWin && !isDraw)}
            />
          )}
        </div>

        {/* Итоговый счёт */}
        {me && opp && (
          <div className="bg-brown-900 border border-brown-800 rounded-2xl px-4 py-4">
            <p className="text-cream-200 text-xs opacity-50 text-center mb-3 uppercase tracking-wider">
              Итоговый счёт
            </p>
            <div className="flex items-center justify-center gap-4">
              {/* Мой скор */}
              <div className="text-center flex-1">
                <p className={`font-bold text-3xl ${isWin ? 'text-hop-400' : 'text-cream-100'}`}>
                  {me.batch?.quality ?? me.score ?? '—'}
                </p>
                <p className="text-cream-200 text-xs opacity-50 mt-0.5">Вы</p>
              </div>

              {/* VS */}
              <p className="text-cream-200 text-sm opacity-40 font-bold shrink-0">VS</p>

              {/* Скор соперника */}
              <div className="text-center flex-1">
                <p className={`font-bold text-3xl ${myResult === 'loss' ? 'text-hop-400' : 'text-cream-100'}`}>
                  {opp.batch?.quality ?? opp.score ?? '—'}
                </p>
                <p className="text-cream-200 text-xs opacity-50 mt-0.5">{opp.displayName}</p>
              </div>
            </div>

            {/* Разница */}
            {me.score != null && opp.score != null && me.score !== opp.score && (
              <p className={`text-center text-xs mt-3 font-semibold ${isWin ? 'text-hop-400' : 'text-red-400'}`}>
                {isWin
                  ? `+${me.score - opp.score} очков преимущества`
                  : `−${opp.score - me.score} очков отставания`}
              </p>
            )}
          </div>
        )}

        {/* Матч ID */}
        <p className="text-center text-cream-200 text-xs opacity-30">
          Матч #{match.id.slice(-8)}
        </p>
      </div>

      {/* Кнопки */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-4 bg-gradient-to-t from-brown-950 via-brown-950/90 to-transparent space-y-2">
        <button
          className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
          onClick={onBack}
        >
          ⚔️ Новая дуэль
        </button>
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
  const { initData }  = useTelegram()
  const { state, connect, createRoom, joinRoom, setReady, leaveRoom } = useMatchWs()

  const [phase, setPhase]           = useState<Phase>('lobby')
  const [matchData, setMatchData]   = useState<MatchData | null>(null)

  // Определяем свой userId из Telegram initData один раз
  const myUserId = useRef<string | null>(null)
  useEffect(() => {
    try {
      const params = new URLSearchParams(initData)
      const user   = JSON.parse(params.get('user') ?? '{}')
      myUserId.current = String(user.id ?? '')
    } catch { /* ignore */ }
  }, [initData])

  // Переход к фазе задания когда матч стартовал
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
      setPhase('waiting')
    }
  }

  function handleResult(data: MatchData) {
    setMatchData(data)
    setPhase('results')
  }

  function handleBack() {
    leaveRoom()
    setPhase('lobby')
    setMatchData(null)
  }

  return (
    <div className="min-h-screen bg-brown-950">
      {phase === 'lobby' && (
        <LobbyPhase
          state={state}
          myUserId={myUserId.current}
          onConnect={connect}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onSetReady={setReady}
          onLeave={handleBack}
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
        <>
          <WaitingPhase
            matchId={state.matchId}
            myUserId={myUserId.current}
            onResult={handleResult}
          />
          <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-4 bg-gradient-to-t from-brown-950 via-brown-950/90 to-transparent">
            <button
              className="w-full bg-brown-800 border border-brown-700 text-cream-200 font-semibold py-3 rounded-2xl active:opacity-80"
              onClick={handleBack}
            >
              ← В лобби
            </button>
          </div>
        </>
      )}

      {phase === 'results' && matchData && (
        <ResultsPhase
          match={matchData}
          myUserId={myUserId.current}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
