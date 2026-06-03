/**
 * Э-3 — Мини-игра варки
 * Этапы: затирание → варка → охлаждение (активные) → брожение → выдержка (фоновые)
 *
 * Механика: движущийся маркер на шкале, игрок нажимает «Зафиксировать» когда маркер
 * попадает в зелёную зону. Позиция → accuracy (0–1).
 */

import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { Batch } from '../lib/api'

// ── Конфигурация этапов ───────────────────────────────────────────────────────

interface StageConfig {
  key:       'mash' | 'hops' | 'chill'
  label:     string
  icon:      string
  desc:      string
  color:     string          // цвет зоны прицела
  targetMin: number          // зелёная зона 0–100
  targetMax: number
  speedMs:   number          // мс на полный проход шкалы
}

const STAGES: StageConfig[] = [
  {
    key:       'mash',
    label:     'Затирание',
    icon:      '🌾',
    desc:      'Удерживай температуру в зелёной зоне — нажми в нужный момент',
    color:     'bg-amber-500',
    targetMin: 38,
    targetMax: 62,
    speedMs:   2200,
  },
  {
    key:       'hops',
    label:     'Варка с хмелем',
    icon:      '🔥',
    desc:      'Поймай пик кипения — добавь хмель точно вовремя',
    color:     'bg-hop-600',
    targetMin: 42,
    targetMax: 58,
    speedMs:   1800,
  },
  {
    key:       'chill',
    label:     'Охлаждение',
    icon:      '❄️',
    desc:      'Останови охлаждение в идеальной точке для дрожжей',
    color:     'bg-blue-500',
    targetMin: 40,
    targetMax: 60,
    speedMs:   1600,
  },
]

// ── Типы ─────────────────────────────────────────────────────────────────────

type GamePhase =
  | { type: 'intro' }
  | { type: 'playing'; stageIdx: number; score: number | null }
  | { type: 'summary'; scores: Record<string, number> }
  | { type: 'fermenting'; batch: Batch }
  | { type: 'error'; message: string }

// ── Компонент шкалы-маркера ───────────────────────────────────────────────────

function TimingBar({
  stage,
  onTap,
  tapped,
  tapPosition,
}: {
  stage:       StageConfig
  onTap:       (pos: number) => void
  tapped:      boolean
  tapPosition: number | null
}) {
  const posRef    = useRef(0)
  const rafRef    = useRef<number>(0)
  const startRef  = useRef(0)
  const [pos, setPos] = useState(0)

  useEffect(() => {
    if (tapped) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    startRef.current = performance.now() - (posRef.current / 100) * stage.speedMs * 0.5

    function tick(now: number) {
      const elapsed = now - startRef.current
      // ping-pong 0→100→0
      const cycle   = stage.speedMs
      const t       = elapsed % (cycle * 2)
      const p       = t < cycle ? (t / cycle) * 100 : 100 - ((t - cycle) / cycle) * 100
      posRef.current = p
      setPos(p)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tapped, stage.speedMs])

  function handleTap() {
    if (!tapped) onTap(posRef.current)
  }

  const inZone = pos >= stage.targetMin && pos <= stage.targetMax

  return (
    <button
      className="w-full select-none active:scale-98 transition-transform"
      onClick={handleTap}
    >
      {/* Шкала */}
      <div className="relative h-14 bg-brown-800 rounded-2xl overflow-hidden mx-1">
        {/* Зелёная зона */}
        <div
          className={`absolute top-0 bottom-0 ${stage.color} opacity-30 rounded-sm`}
          style={{
            left:  `${stage.targetMin}%`,
            width: `${stage.targetMax - stage.targetMin}%`,
          }}
        />
        {/* Метка попадания */}
        {tapped && tapPosition != null && (
          <div
            className="absolute top-1 bottom-1 w-1 bg-white rounded-full transition-none"
            style={{ left: `${tapPosition}%`, transform: 'translateX(-50%)' }}
          />
        )}
        {/* Маркер */}
        {!tapped && (
          <div
            className={`absolute top-2 bottom-2 w-3 rounded-full transition-none shadow-lg ${
              inZone ? `${stage.color} shadow-amber-500/50` : 'bg-cream-200'
            }`}
            style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
          />
        )}
        {/* Текст-подсказка */}
        {!tapped && (
          <p className={`absolute inset-0 flex items-center justify-center text-sm font-bold pointer-events-none ${
            inZone ? 'text-amber-300' : 'text-cream-200 opacity-40'
          }`}>
            {inZone ? '✅ СЕЙЧАС!' : 'нажми в зелёной зоне'}
          </p>
        )}
      </div>
    </button>
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
  const [tapped,      setTapped]      = useState(false)
  const [tapPosition, setTapPosition] = useState<number | null>(null)
  const [score,       setScore]       = useState<number | null>(null)
  const [countdown,   setCountdown]   = useState(3)
  const [started,     setStarted]     = useState(false)

  // Отсчёт 3-2-1 перед этапом
  useEffect(() => {
    if (started) return
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); setStarted(true); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [started])

  function calcScore(pos: number): number {
    const { targetMin, targetMax } = stage
    const center = (targetMin + targetMax) / 2
    const half   = (targetMax - targetMin) / 2

    if (pos < targetMin || pos > targetMax) {
      // За зоной — расстояние от края → штраф
      const dist = Math.min(Math.abs(pos - targetMin), Math.abs(pos - targetMax))
      return Math.max(0.3, 1 - (dist / 30))
    }
    // В зоне — ближе к центру = лучше
    const distCenter = Math.abs(pos - center)
    return Math.min(1, 0.7 + (1 - distCenter / half) * 0.3)
  }

  function handleTap(pos: number) {
    const s = calcScore(pos)
    const rounded = Math.round(s * 100) / 100
    setTapped(true)
    setTapPosition(pos)
    setScore(rounded)
  }

  const scoreLabel =
    score == null ? ''
    : score >= 0.9 ? '🏆 Отлично!'
    : score >= 0.7 ? '✅ Хорошо'
    : score >= 0.5 ? '⚠️ Неплохо'
    : '❌ Мимо'

  const scoreColor =
    score == null ? ''
    : score >= 0.9 ? 'text-hop-400'
    : score >= 0.7 ? 'text-amber-400'
    : score >= 0.5 ? 'text-amber-600'
    : 'text-red-400'

  return (
    <div className="flex flex-col items-center px-4 pt-6 space-y-6">
      {/* Прогресс этапов */}
      <div className="flex gap-2 w-full">
        {Array.from({ length: totalStages }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i < stageIdx  ? 'bg-hop-600'
              : i === stageIdx ? 'bg-amber-500'
              : 'bg-brown-800'
            }`}
          />
        ))}
      </div>

      {/* Этап */}
      <div className="text-center">
        <p className="text-5xl mb-2">{stage.icon}</p>
        <h2 className="text-cream-100 font-bold text-xl">{stage.label}</h2>
        <p className="text-cream-200 text-sm opacity-60 mt-1 max-w-xs">{stage.desc}</p>
      </div>

      {/* Отсчёт */}
      {!started && (
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-brown-800 border-2 border-amber-600">
          <span className="text-amber-400 font-bold text-3xl">{countdown || '!'}</span>
        </div>
      )}

      {/* Шкала */}
      {started && (
        <div className="w-full space-y-4">
          <TimingBar
            stage={stage}
            onTap={handleTap}
            tapped={tapped}
            tapPosition={tapPosition}
          />

          {/* Результат нажатия */}
          {tapped && score != null && (
            <div className="text-center space-y-1 animate-fade-in">
              <p className={`font-bold text-2xl ${scoreColor}`}>{scoreLabel}</p>
              <p className="text-cream-200 text-sm opacity-60">
                Точность: {Math.round(score * 100)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Кнопка "Далее" */}
      {tapped && score != null && (
        <button
          className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
          onClick={() => onComplete(score)}
        >
          {stageIdx < totalStages - 1 ? 'Следующий этап →' : '🍺 Завершить варку'}
        </button>
      )}
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
    async function submit() {
      try {
        const batch = await api.completeStage(batchId, {
          mash:   scores.mash   ?? 0.8,
          hops:   scores.hops   ?? 0.8,
          chill:  scores.chill  ?? 0.8,
        })
        onDone(batch)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка отправки результата')
      }
    }
    submit()
  }, [batchId, scores, onDone])

  if (error) {
    return (
      <div className="flex flex-col items-center py-12 px-4 space-y-4">
        <p className="text-red-400 text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-16 space-y-4">
      <div className="text-5xl animate-spin" style={{ animationDuration: '2s' }}>⚗️</div>
      <p className="text-cream-100 font-bold">Отправляем результаты…</p>
    </div>
  )
}

// ── Финальный экран (брожение запущено) ───────────────────────────────────────

function FermentingScreen({
  batch,
  scores,
  onDone,
}: {
  batch:  Batch
  scores: Record<string, number>
  onDone: () => void
}) {
  const avgAccuracy = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
  const qualityLabel =
    avgAccuracy >= 0.9 ? 'Мастерская варка'
    : avgAccuracy >= 0.7 ? 'Хорошая варка'
    : 'Приемлемая варка'

  const readyAt = batch.readyAt ? new Date(batch.readyAt) : null
  const hoursLeft = readyAt
    ? Math.ceil((readyAt.getTime() - Date.now()) / 3_600_000)
    : null

  return (
    <div className="flex flex-col items-center px-4 pt-8 space-y-6">
      <div className="text-6xl">🧪</div>

      <div className="text-center">
        <h2 className="text-cream-100 font-bold text-xl">Варка завершена!</h2>
        <p className="text-cream-200 text-sm opacity-60 mt-1">Брожение запущено</p>
      </div>

      {/* Итоги этапов */}
      <div className="w-full bg-brown-900 border border-brown-800 rounded-2xl px-4 py-4 space-y-3">
        <p className="text-cream-200 text-xs opacity-50 uppercase tracking-wider">Точность по этапам</p>
        {STAGES.map((s) => {
          const sc = scores[s.key] ?? 0
          return (
            <div key={s.key} className="flex items-center gap-3">
              <span className="text-lg w-6">{s.icon}</span>
              <span className="text-cream-200 text-sm flex-1">{s.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-brown-800 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${sc * 100}%` }}
                  />
                </div>
                <span className="text-amber-400 text-xs font-bold w-8 text-right">
                  {Math.round(sc * 100)}%
                </span>
              </div>
            </div>
          )
        })}

        <div className="border-t border-brown-700 pt-2 mt-1 text-center">
          <p className="text-amber-400 text-xs font-semibold">{qualityLabel}</p>
        </div>
      </div>

      {/* Таймер брожения */}
      {hoursLeft != null && (
        <div className="w-full bg-hop-900 border border-hop-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <p className="text-hop-300 font-semibold text-sm">Готово через ~{hoursLeft} ч</p>
            <p className="text-cream-200 text-xs opacity-50">
              Мы пришлём уведомление когда пиво созреет
            </p>
          </div>
        </div>
      )}

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

interface BrewingGameProps {
  batchId: string
  onDone:  () => void
}

export function BrewingGame({ batchId, onDone }: BrewingGameProps) {
  const [phase,  setPhase]  = useState<GamePhase>({ type: 'intro' })
  const [scores, setScores] = useState<Record<string, number>>({})

  function handleStageComplete(stageIdx: number, score: number) {
    const stage   = STAGES[stageIdx]
    const updated = { ...scores, [stage.key]: score }
    setScores(updated)

    if (stageIdx < STAGES.length - 1) {
      setPhase({ type: 'playing', stageIdx: stageIdx + 1, score: null })
    } else {
      setPhase({ type: 'summary', scores: updated })
    }
  }

  function handleSubmitDone(batch: Batch) {
    setPhase({ type: 'fermenting', batch })
  }

  return (
    <div className="min-h-screen bg-brown-950 pb-8">
      {/* Шапка */}
      <div className="bg-brown-900 border-b border-brown-800 px-4 py-4">
        <h1 className="text-cream-100 font-bold text-lg">🍺 Процесс варки</h1>
        {phase.type === 'playing' && (
          <p className="text-cream-200 text-xs opacity-50 mt-0.5">
            Этап {phase.stageIdx + 1} из {STAGES.length}
          </p>
        )}
      </div>

      {/* Intro */}
      {phase.type === 'intro' && (
        <div className="flex flex-col items-center px-4 pt-12 space-y-6">
          <div className="text-6xl">⚗️</div>
          <div className="text-center">
            <h2 className="text-cream-100 font-bold text-xl">Начинаем варку!</h2>
            <p className="text-cream-200 text-sm opacity-60 mt-2 max-w-xs">
              Три этапа: затирание, варка с хмелем, охлаждение.
              Нажимай на кнопку когда маркер попадает в зелёную зону.
            </p>
          </div>
          <div className="w-full space-y-2">
            {STAGES.map((s, i) => (
              <div key={s.key} className="flex items-center gap-3 bg-brown-900 border border-brown-800 rounded-xl px-4 py-3">
                <span className="text-xl">{s.icon}</span>
                <div>
                  <p className="text-cream-100 text-sm font-semibold">{s.label}</p>
                  <p className="text-cream-200 text-xs opacity-50">Этап {i + 1}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
            onClick={() => setPhase({ type: 'playing', stageIdx: 0, score: null })}
          >
            🚀 Начать!
          </button>
        </div>
      )}

      {/* Этап */}
      {phase.type === 'playing' && (
        <StageScreen
          stage={STAGES[phase.stageIdx]}
          stageIdx={phase.stageIdx}
          totalStages={STAGES.length}
          onComplete={(score) => handleStageComplete(phase.stageIdx, score)}
        />
      )}

      {/* Отправка */}
      {phase.type === 'summary' && (
        <SummaryScreen
          batchId={batchId}
          scores={phase.scores}
          onDone={handleSubmitDone}
        />
      )}

      {/* Брожение */}
      {phase.type === 'fermenting' && (
        <FermentingScreen
          batch={phase.batch}
          scores={scores}
          onDone={onDone}
        />
      )}

      {phase.type === 'error' && (
        <div className="px-4 pt-12 text-center">
          <p className="text-red-400">{phase.message}</p>
          <button className="mt-4 text-amber-400 underline text-sm" onClick={onDone}>
            Вернуться
          </button>
        </div>
      )}
    </div>
  )
}
