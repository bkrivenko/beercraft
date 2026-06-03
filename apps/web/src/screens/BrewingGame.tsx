/**
 * Э-3 — Мини-игра варки
 * Механика: движущийся маркер, большая кнопка внизу «ЖМИ!»
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import type { Batch } from '../lib/api'

// ── Конфигурация этапов ───────────────────────────────────────────────────────

interface StageConfig {
  key:       'mash' | 'hops' | 'chill'
  label:     string
  icon:      string
  desc:      string
  targetMin: number   // зелёная зона 0–100
  targetMax: number
  speedMs:   number   // мс на полный проход шкалы (ping-pong)
}

const STAGES: StageConfig[] = [
  {
    key:       'mash',
    label:     'Затирание',
    icon:      '🌾',
    desc:      'Маркер движется по шкале. Нажми большую кнопку когда он попадёт в зелёную зону!',
    targetMin: 35,
    targetMax: 65,
    speedMs:   2400,
  },
  {
    key:       'hops',
    label:     'Варка с хмелем',
    icon:      '🔥',
    desc:      'Зелёная зона уже — нужна точность! Нажми в нужный момент.',
    targetMin: 40,
    targetMax: 60,
    speedMs:   2000,
  },
  {
    key:       'chill',
    label:     'Охлаждение',
    icon:      '❄️',
    desc:      'Маркер быстрее. Успей поймать зелёную зону!',
    targetMin: 40,
    targetMax: 60,
    speedMs:   1700,
  },
]

// ── Типы ─────────────────────────────────────────────────────────────────────

type GamePhase =
  | { type: 'intro' }
  | { type: 'playing'; stageIdx: number }
  | { type: 'summary'; scores: Record<string, number> }
  | { type: 'fermenting'; batch: Batch }
  | { type: 'error'; message: string }

// ── Шкала (только визуал, не кнопка) ─────────────────────────────────────────

function TimingBar({
  stage,
  pos,
  tapped,
  tapPos,
}: {
  stage:  StageConfig
  pos:    number
  tapped: boolean
  tapPos: number | null
}) {
  const inZone = pos >= stage.targetMin && pos <= stage.targetMax

  return (
    <div className="relative h-16 bg-brown-800 rounded-2xl overflow-hidden w-full">
      {/* Зелёная зона */}
      <div
        className="absolute top-0 bottom-0 bg-hop-600 opacity-40 rounded-sm"
        style={{ left: `${stage.targetMin}%`, width: `${stage.targetMax - stage.targetMin}%` }}
      />

      {/* Граничные метки зоны */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-hop-500 opacity-70"
        style={{ left: `${stage.targetMin}%` }} />
      <div className="absolute top-0 bottom-0 w-0.5 bg-hop-500 opacity-70"
        style={{ left: `${stage.targetMax}%` }} />

      {/* Метка попадания (после нажатия) */}
      {tapped && tapPos != null && (
        <div
          className="absolute top-1 bottom-1 w-1.5 bg-white rounded-full shadow-lg"
          style={{ left: `${tapPos}%`, transform: 'translateX(-50%)' }}
        />
      )}

      {/* Движущийся маркер */}
      {!tapped && (
        <div
          className={`absolute top-2 bottom-2 w-4 rounded-full shadow-xl transition-none ${
            inZone ? 'bg-amber-400 shadow-amber-400/60' : 'bg-cream-100'
          }`}
          style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
        />
      )}

      {/* Надпись внутри */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {!tapped && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            inZone
              ? 'bg-amber-400 text-brown-950'
              : 'bg-brown-700/80 text-cream-200 opacity-60'
          }`}>
            {inZone ? '🎯 СЕЙЧАС!' : 'жди зелёную зону'}
          </span>
        )}
        {tapped && (
          <span className="text-cream-100 text-xs font-semibold opacity-70">зафиксировано</span>
        )}
      </div>
    </div>
  )
}

// ── Экран одного этапа ────────────────────────────────────────────────────────

function StageScreen({
  stage,
  stageIdx,
  totalStages,
  onComplete,
}: {
  stage:       StageConfig
  stageIdx:    number
  totalStages: number
  onComplete:  (score: number) => void
}) {
  const [phase,       setPhase]       = useState<'countdown' | 'playing' | 'result'>('countdown')
  const [countdown,   setCountdown]   = useState(3)
  const [pos,         setPos]         = useState(0)
  const [tapPos,      setTapPos]      = useState<number | null>(null)
  const [score,       setScore]       = useState<number | null>(null)

  const posRef   = useRef(0)
  const rafRef   = useRef<number>(0)
  const startRef = useRef(0)

  // Countdown 3-2-1
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t)
          setPhase('playing')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Анимация маркера
  useEffect(() => {
    if (phase !== 'playing') return

    startRef.current = performance.now()

    function tick(now: number) {
      const elapsed = now - startRef.current
      const cycle   = stage.speedMs
      const t       = elapsed % (cycle * 2)
      const p       = t < cycle ? (t / cycle) * 100 : 100 - ((t - cycle) / cycle) * 100
      posRef.current = p
      setPos(p)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, stage.speedMs])

  const handleTap = useCallback(() => {
    if (phase !== 'playing') return
    cancelAnimationFrame(rafRef.current)

    const p = posRef.current
    const { targetMin, targetMax } = stage
    const center = (targetMin + targetMax) / 2
    const half   = (targetMax - targetMin) / 2

    let s: number
    if (p >= targetMin && p <= targetMax) {
      // В зоне: 0.7–1.0 в зависимости от близости к центру
      const distCenter = Math.abs(p - center)
      s = Math.min(1, 0.7 + (1 - distCenter / half) * 0.3)
    } else {
      // Мимо: штраф по дистанции
      const dist = Math.min(Math.abs(p - targetMin), Math.abs(p - targetMax))
      s = Math.max(0.2, 0.65 - dist / 40)
    }
    const rounded = Math.round(s * 100) / 100

    setTapPos(p)
    setScore(rounded)
    setPhase('result')
  }, [phase, stage])

  const inZone     = pos >= stage.targetMin && pos <= stage.targetMax
  const scoreLabel = score == null ? '' : score >= 0.9 ? '🏆 Отлично!' : score >= 0.7 ? '✅ Хорошо' : score >= 0.5 ? '⚠️ Неплохо' : '❌ Мимо'
  const scoreColor = score == null ? '' : score >= 0.9 ? 'text-hop-400' : score >= 0.7 ? 'text-amber-400' : score >= 0.5 ? 'text-amber-600' : 'text-red-400'

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Прогресс */}
      <div className="flex gap-2 px-4 pt-4">
        {Array.from({ length: totalStages }).map((_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full ${
            i < stageIdx ? 'bg-hop-600' : i === stageIdx ? 'bg-amber-500' : 'bg-brown-800'
          }`} />
        ))}
      </div>

      {/* Этап — иконка и название */}
      <div className="text-center px-4 pt-5">
        <p className="text-5xl mb-2">{stage.icon}</p>
        <h2 className="text-cream-100 font-bold text-xl">{stage.label}</h2>
        <p className="text-cream-200 text-sm opacity-60 mt-1 max-w-xs mx-auto">{stage.desc}</p>
      </div>

      {/* Шкала */}
      <div className="px-4 pt-6">
        {phase === 'countdown' ? (
          <div className="h-16 bg-brown-800 rounded-2xl flex items-center justify-center">
            <span className="text-amber-400 font-bold text-2xl opacity-40">готовься…</span>
          </div>
        ) : (
          <TimingBar
            stage={stage}
            pos={pos}
            tapped={phase === 'result'}
            tapPos={tapPos}
          />
        )}
      </div>

      {/* Результат попадания */}
      {phase === 'result' && score != null && (
        <div className="text-center pt-4 space-y-1">
          <p className={`font-bold text-2xl ${scoreColor}`}>{scoreLabel}</p>
          <p className="text-cream-200 text-sm opacity-60">
            Точность: {Math.round(score * 100)}%
            {score >= 0.9 ? ' — идеально!' : score >= 0.7 ? ' — хорошо' : score >= 0.5 ? ' — пойдёт' : ' — в следующий раз точнее'}
          </p>
        </div>
      )}

      {/* БОЛЬШАЯ КНОПКА внизу — главный элемент управления */}
      <div className="flex-1 flex flex-col justify-end px-4 pb-8 pt-6">
        {phase === 'countdown' && (
          <div className="w-full rounded-3xl bg-brown-800 border-2 border-brown-700 flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-amber-400 font-black text-6xl leading-none">{countdown}</span>
            <span className="text-cream-200 text-sm opacity-60">приготовься</span>
          </div>
        )}

        {phase === 'playing' && (
          <button
            className={`w-full rounded-3xl py-10 flex flex-col items-center justify-center gap-2 select-none transition-all active:scale-95 ${
              inZone
                ? 'bg-amber-500 shadow-xl shadow-amber-500/40 border-2 border-amber-400'
                : 'bg-brown-800 border-2 border-brown-600'
            }`}
            onClick={handleTap}
          >
            <span className="text-4xl">{inZone ? '🎯' : '👆'}</span>
            <span className={`font-black text-2xl ${inZone ? 'text-brown-950' : 'text-cream-200 opacity-50'}`}>
              {inZone ? 'ЖМИ!' : 'жди…'}
            </span>
          </button>
        )}

        {phase === 'result' && (
          <button
            className="w-full bg-amber-600 text-brown-950 font-bold py-4 rounded-2xl text-lg shadow-lg active:opacity-80"
            onClick={() => score != null && onComplete(score)}
          >
            {stageIdx < totalStages - 1 ? 'Следующий этап →' : '🍺 Завершить варку'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Экран итогов (отправка на сервер) ─────────────────────────────────────────

function SummaryScreen({
  batchId,
  scores,
  onDone,
}: {
  batchId: string
  scores:  Record<string, number>
  onDone:  (batch: Batch) => void
}) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.completeStage(batchId, {
      mash:  scores.mash  ?? 0.8,
      hops:  scores.hops  ?? 0.8,
      chill: scores.chill ?? 0.8,
    })
      .then(onDone)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка отправки'))
  }, [batchId, scores, onDone])

  if (error) return (
    <div className="flex flex-col items-center py-12 px-4 space-y-4">
      <p className="text-4xl">😕</p>
      <p className="text-red-400 text-center">{error}</p>
    </div>
  )

  return (
    <div className="flex flex-col items-center py-16 space-y-4">
      <div className="text-5xl animate-spin" style={{ animationDuration: '2s' }}>⚗️</div>
      <p className="text-cream-100 font-bold text-lg">Считаем результат…</p>
    </div>
  )
}

// ── Финальный экран ───────────────────────────────────────────────────────────

function FermentingScreen({ batch, scores, onDone }: { batch: Batch; scores: Record<string, number>; onDone: () => void }) {
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Math.max(Object.values(scores).length, 1)
  const label = avg >= 0.9 ? 'Мастерская варка 🏆' : avg >= 0.7 ? 'Хорошая варка ✅' : 'Приемлемая варка'
  const readyAt = batch.readyAt ? new Date(batch.readyAt) : null
  const hoursLeft = readyAt ? Math.ceil((readyAt.getTime() - Date.now()) / 3_600_000) : null

  return (
    <div className="flex flex-col items-center px-4 pt-8 pb-8 space-y-5">
      <div className="text-6xl">🧪</div>
      <div className="text-center">
        <h2 className="text-cream-100 font-bold text-xl">Варка завершена!</h2>
        <p className="text-amber-400 font-semibold mt-1">{label}</p>
        <p className="text-cream-200 text-sm opacity-60 mt-1">
          Пиво уйдёт на склад когда дозреет
        </p>
      </div>

      <div className="w-full bg-brown-900 border border-brown-800 rounded-2xl px-4 py-4 space-y-3">
        <p className="text-cream-200 text-xs opacity-50 uppercase tracking-wider">Точность по этапам</p>
        {STAGES.map((s) => {
          const sc = scores[s.key] ?? 0
          const col = sc >= 0.9 ? 'bg-hop-500' : sc >= 0.7 ? 'bg-amber-500' : sc >= 0.5 ? 'bg-amber-700' : 'bg-red-700'
          return (
            <div key={s.key} className="flex items-center gap-3">
              <span className="text-lg w-6">{s.icon}</span>
              <span className="text-cream-200 text-sm flex-1">{s.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-brown-800 rounded-full overflow-hidden">
                  <div className={`h-2 rounded-full ${col}`} style={{ width: `${sc * 100}%` }} />
                </div>
                <span className="text-amber-400 text-xs font-bold w-8 text-right">{Math.round(sc * 100)}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {hoursLeft != null && (
        <div className="w-full bg-hop-900 border border-hop-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <p className="text-hop-300 font-semibold text-sm">Готово через ~{hoursLeft} ч</p>
            <p className="text-cream-200 text-xs opacity-50">Уведомим когда пиво созреет</p>
          </div>
        </div>
      )}

      <div className="w-full bg-brown-900 border border-brown-800 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-xl">💡</span>
        <p className="text-cream-200 text-xs opacity-70">
          Когда пиво созреет — оно появится на главном экране. Продай его в <strong className="text-amber-400">Рынке → Продажа</strong> или выполни заказ NPC.
        </p>
      </div>
      <button
        className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
        onClick={onDone}
      >
        🍺 На главный экран
      </button>
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────

export function BrewingGame({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const [phase,  setPhase]  = useState<GamePhase>({ type: 'intro' })
  const [scores, setScores] = useState<Record<string, number>>({})

  function handleStageComplete(stageIdx: number, score: number) {
    const updated = { ...scores, [STAGES[stageIdx].key]: score }
    setScores(updated)
    if (stageIdx < STAGES.length - 1) {
      setPhase({ type: 'playing', stageIdx: stageIdx + 1 })
    } else {
      setPhase({ type: 'summary', scores: updated })
    }
  }

  return (
    <div className="min-h-screen bg-brown-950">
      <div className="bg-brown-900 border-b border-brown-800 px-4 py-4">
        <h1 className="text-cream-100 font-bold text-lg">🍺 Процесс варки</h1>
        {phase.type === 'playing' && (
          <p className="text-cream-200 text-xs opacity-50 mt-0.5">
            Этап {phase.stageIdx + 1} из {STAGES.length}
          </p>
        )}
      </div>

      {phase.type === 'intro' && (
        <div className="flex flex-col items-center px-4 pt-8 space-y-5">
          <div className="text-6xl">⚗️</div>
          <div className="text-center">
            <h2 className="text-cream-100 font-bold text-xl">Начинаем варку!</h2>
            <p className="text-cream-200 text-sm opacity-60 mt-2 max-w-xs">
              3 этапа. В каждом — движущийся маркер и большая кнопка внизу.
              Нажимай кнопку когда маркер в <span className="text-hop-400 font-semibold">зелёной зоне</span>.
            </p>
          </div>

          {/* Превью механики */}
          <div className="w-full bg-brown-900 border border-brown-800 rounded-2xl p-4 space-y-3">
            <div className="relative h-10 bg-brown-800 rounded-xl overflow-hidden">
              <div className="absolute top-0 bottom-0 bg-hop-600 opacity-40 rounded-sm" style={{ left: '35%', width: '30%' }} />
              <div className="absolute top-2 bottom-2 w-3 rounded-full bg-amber-400 shadow-lg animate-bounce" style={{ left: '50%', transform: 'translateX(-50%)' }} />
            </div>
            <p className="text-cream-200 text-xs text-center opacity-60">← маркер движется туда-сюда, зелёная зона — цель</p>
          </div>

          {STAGES.map((s, i) => (
            <div key={s.key} className="w-full flex items-center gap-3 bg-brown-900 border border-brown-800 rounded-xl px-4 py-3">
              <span className="text-xl">{s.icon}</span>
              <div>
                <p className="text-cream-100 text-sm font-semibold">{s.label}</p>
                <p className="text-cream-200 text-xs opacity-50">Этап {i + 1}</p>
              </div>
            </div>
          ))}

          <button
            className="w-full bg-amber-600 text-brown-950 font-bold py-4 rounded-2xl text-lg shadow-lg active:opacity-80"
            onClick={() => setPhase({ type: 'playing', stageIdx: 0 })}
          >
            🚀 Начать!
          </button>
        </div>
      )}

      {phase.type === 'playing' && (
        <StageScreen
          stage={STAGES[phase.stageIdx]}
          stageIdx={phase.stageIdx}
          totalStages={STAGES.length}
          onComplete={(score) => handleStageComplete(phase.stageIdx, score)}
        />
      )}

      {phase.type === 'summary' && (
        <SummaryScreen batchId={batchId} scores={phase.scores} onDone={(batch) => setPhase({ type: 'fermenting', batch })} />
      )}

      {phase.type === 'fermenting' && (
        <FermentingScreen batch={phase.batch} scores={scores} onDone={onDone} />
      )}

      {phase.type === 'error' && (
        <div className="px-4 pt-12 text-center">
          <p className="text-red-400">{phase.message}</p>
          <button className="mt-4 text-amber-400 underline text-sm" onClick={onDone}>Вернуться</button>
        </div>
      )}
    </div>
  )
}
