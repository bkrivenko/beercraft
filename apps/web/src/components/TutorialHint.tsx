/**
 * TutorialHint — плавающая карточка подсказки с анимацией.
 * Показывается поверх контента, не блокирует нажатия под собой.
 */
import { useEffect, useState } from 'react'
import type { TutorialStep } from '../lib/tutorial'
import { advanceTutorial, disableTutorial } from '../lib/tutorial'

interface TutorialHintProps {
  step:         TutorialStep | null
  onAdvance:    () => void          // вызывается после advanceTutorial, чтобы ребрендить
  userLevel:    number
  totalSteps:   number
  currentIndex: number
}

export function TutorialHint({ step, onAdvance, userLevel, totalSteps, currentIndex }: TutorialHintProps) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  // Если уровень >= 2 — отключаем туториал
  useEffect(() => {
    if (userLevel >= 2) {
      disableTutorial()
      onAdvance()
    }
  }, [userLevel, onAdvance])

  // Анимация появления при смене шага
  useEffect(() => {
    if (!step) { setVisible(false); return }
    setExiting(false)
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [step?.id])

  if (!step || userLevel >= 2) return null

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(() => {
      advanceTutorial()
      setVisible(false)
      onAdvance()
    }, 200)
  }

  const handleSkipAll = () => {
    setExiting(true)
    setTimeout(() => {
      disableTutorial()
      setVisible(false)
      onAdvance()
    }, 200)
  }

  const progress = totalSteps > 0 ? ((currentIndex) / totalSteps) * 100 : 0

  return (
    <>
      {/* Подсветка элемента — через CSS атрибут data-tutorial */}
      {step.highlight && (
        <style>{`
          [data-tutorial="${step.highlight}"] {
            position: relative;
            z-index: 41;
            box-shadow: 0 0 0 3px #f59e0b, 0 0 0 6px rgba(245,158,11,0.3);
            border-radius: 12px;
            animation: tutorialPulse 1.5s ease-in-out infinite;
          }
          @keyframes tutorialPulse {
            0%, 100% { box-shadow: 0 0 0 3px #f59e0b, 0 0 0 6px rgba(245,158,11,0.3); }
            50%       { box-shadow: 0 0 0 3px #f59e0b, 0 0 0 12px rgba(245,158,11,0.15); }
          }
        `}</style>
      )}

      {/* Затемнение фона (лёгкое, не блокирует) */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.25)', transition: 'opacity 0.2s', opacity: visible && !exiting ? 1 : 0 }}
      />

      {/* Карточка подсказки */}
      <div
        className="fixed left-0 right-0 z-50 px-3 pb-20"
        style={{
          bottom: 0,
          transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          transform: visible && !exiting ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
          opacity:   visible && !exiting ? 1 : 0,
        }}
      >
        {/* Стрелка вверх */}
        {step.arrow === 'up' && (
          <div className="flex justify-center mb-1">
            <div className="text-amber-500 text-2xl animate-bounce" style={{ animationDuration: '1.2s' }}>↑</div>
          </div>
        )}

        <div className="bg-brown-900 border border-amber-600/60 rounded-2xl shadow-2xl overflow-hidden">
          {/* Прогресс-бар */}
          <div className="h-1 bg-brown-800">
            <div
              className="h-1 bg-amber-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-4 space-y-3">
            {/* Заголовок */}
            <div className="flex items-start gap-3">
              <span className="text-3xl flex-shrink-0 mt-0.5">{step.emoji}</span>
              <div className="flex-1">
                <h3 className="text-cream-100 font-black text-base leading-tight">{step.title}</h3>
                <p className="text-cream-200 text-sm leading-relaxed mt-1 opacity-80">{step.text}</p>
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex gap-2">
              <button
                onClick={handleSkipAll}
                className="text-cream-200 text-xs opacity-40 active:opacity-60 px-2 py-2"
              >
                Пропустить всё
              </button>
              <div className="flex-1" />
              {/* Индикатор шага */}
              <div className="flex items-center gap-1 mr-2">
                {Array.from({ length: Math.min(totalSteps, 10) }).map((_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-300 ${
                    i === currentIndex % 10
                      ? 'w-4 h-1.5 bg-amber-500'
                      : i < currentIndex % 10
                      ? 'w-1.5 h-1.5 bg-amber-700'
                      : 'w-1.5 h-1.5 bg-brown-700'
                  }`} />
                ))}
              </div>
              <button
                onClick={handleDismiss}
                className="bg-amber-600 text-brown-950 font-bold text-sm px-5 py-2 rounded-xl active:opacity-80"
              >
                {step.completeOn === 'navigate' ? 'Давай!' : 'Понятно!'}
              </button>
            </div>
          </div>
        </div>

        {/* Стрелка вниз */}
        {step.arrow === 'down' && (
          <div className="flex justify-center mt-1">
            <div className="text-amber-500 text-2xl animate-bounce" style={{ animationDuration: '1.2s' }}>↓</div>
          </div>
        )}
      </div>
    </>
  )
}
