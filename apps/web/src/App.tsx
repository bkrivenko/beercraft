import { useState, useCallback, useEffect } from 'react'
import { HomeScreen }          from './screens/HomeScreen'
import { RecipeConstructor }   from './screens/recipe/RecipeConstructor'
import { BrewingGame }         from './screens/BrewingGame'
import { MarketScreen }        from './screens/MarketScreen'
import { ProfileScreen }       from './screens/ProfileScreen'
import { DuelScreen }          from './screens/DuelScreen'
import { StylesScreen }        from './screens/StylesScreen'
import { OnboardingScreen }    from './screens/OnboardingScreen'
import { TutorialHint }        from './components/TutorialHint'
import { api, ApiError }       from './lib/api'
import type { StartBatchBody } from './lib/api'
import {
  getTutorialStepForScreen,
  getTutorialStep,
  isTutorialDone,
  TUTORIAL_STEPS,
} from './lib/tutorial'
import './App.css'

type Screen = 'home' | 'recipe' | 'brewing' | 'styles' | 'market' | 'duel' | 'profile'

// ── Bottom Navigation ─────────────────────────────────────────────────────────
const NAV_ITEMS: Array<{ key: Screen; icon: string; label: string }> = [
  { key: 'home',    icon: '🍺', label: 'Пивоварня' },
  { key: 'styles',  icon: '📖', label: 'Рецепты'   },
  { key: 'market',  icon: '🏪', label: 'Рынок'     },
  { key: 'duel',    icon: '⚔️', label: 'Дуэль'     },
  { key: 'profile', icon: '👤', label: 'Профиль'   },
]

function BottomNav({ current, onChange }: { current: Screen; onChange: (s: Screen) => void }) {
  const activeKey = ['recipe', 'brewing'].includes(current) ? 'home' : current
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brown-900 border-t border-brown-800 flex z-30">
      {NAV_ITEMS.map(({ key, icon, label }) => (
        <button
          key={key}
          className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-colors ${
            activeKey === key
              ? 'text-amber-600 font-semibold'
              : 'text-cream-200 opacity-50 active:opacity-80'
          }`}
          onClick={() => onChange(key)}
        >
          <span className="text-xl leading-none mb-0.5">{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,         setScreen]         = useState<Screen>('home')
  const [batchId,        setBatchId]        = useState<string | null>(null)
  const [brewError,      setBrewError]      = useState<string | null>(null)
  const [brewing,        setBrewing]        = useState(false)
  const [recipeStyleKey, setRecipeStyleKey] = useState<string | undefined>(undefined)
  const [userLevel,      setUserLevel]      = useState(1)
  const [isBlocked,      setIsBlocked]      = useState(false)

  // Tutorial — перерисовываем при смене шага
  const [tutorialTick, setTutorialTick] = useState(0)
  const refreshTutorial = useCallback(() => setTutorialTick(t => t + 1), [])

  // Онбординг
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    const localDone = localStorage.getItem('beercraft_onboarding_done') === 'true'
    if (localDone) { setShowOnboarding(false); return }
    api.getMe()
      .then(me => {
        setUserLevel(me.level ?? 1)
        if ((me as any).isBlocked) { setIsBlocked(true); setShowOnboarding(false); return }
        if (me.onboardingDone) {
          localStorage.setItem('beercraft_onboarding_done', 'true')
          setShowOnboarding(false)
        } else {
          setShowOnboarding(true)
        }
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.code === 'BLOCKED') {
          setIsBlocked(true)
          setShowOnboarding(false)
        } else {
          setShowOnboarding(true)
        }
      })
  }, [])

  // Подгружаем уровень периодически + проверяем блокировку
  useEffect(() => {
    const id = setInterval(() => {
      api.getMe()
        .then(me => setUserLevel(me.level ?? 1))
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.code === 'BLOCKED') setIsBlocked(true)
        })
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const showNav = !['recipe', 'brewing'].includes(screen)

  const handleBrew = useCallback(async (recipe: Omit<StartBatchBody, 'name'>) => {
    setBrewing(true)
    setBrewError(null)
    try {
      const styleName = (recipe as any).targetStyleKey ?? 'Пиво'
      const body: StartBatchBody = {
        name: `${styleName} ${new Date().toLocaleDateString('ru')}`,
        ...recipe,
      }
      const batch = await api.startBatch(body)
      setBatchId(batch.id)
      setScreen('brewing')
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Ошибка запуска варки'
      let msg = raw
      if (raw.includes('INSUFFICIENT_STOCK') || raw.includes('Недостаточно'))
        msg = '❌ Недостаточно ингредиентов на складе. Купи их в Рынке → Магазин.'
      else if (raw.includes('MAX_BATCHES_REACHED') || raw.includes('одновременно'))
        msg = '❌ Максимум 2 варки одновременно. Дождись окончания текущих.'
      else if (raw.includes('EMPTY_MALTS') || raw.includes('засыпь'))
        msg = '❌ Добавь хотя бы один солод в рецепт.'
      else if (raw.includes('EMPTY_HOPS') || raw.includes('хмелевая'))
        msg = '❌ Добавь хотя бы один хмель в рецепт.'
      else if (raw.includes('401') || raw.includes('initData'))
        msg = '❌ Ошибка авторизации. Перезапусти приложение в Telegram.'
      else if (raw.includes('500') || raw.includes('Internal'))
        msg = '❌ Ошибка сервера. Попробуй ещё раз через несколько секунд.'
      setBrewError(msg)
      setScreen('home')
    } finally {
      setBrewing(false)
    }
  }, [])

  const handleStartBrew = useCallback((styleKey?: string) => {
    setBrewError(null)
    setRecipeStyleKey(styleKey)
    setScreen('recipe')
  }, [])

  // Определяем текущий шаг туториала для экрана
  const tutorialStep = isTutorialDone()
    ? null
    : getTutorialStepForScreen(screen)

  // Когда переходим на экран — сразу проверяем нужно ли advance (шаг другого экрана)
  // Например если шаг "home_welcome" и мы перешли в recipe — advance автоматически
  useEffect(() => {
    if (isTutorialDone()) return
    const step = getTutorialStep()
    const currentStepDef = TUTORIAL_STEPS[step]
    if (!currentStepDef) return
    // Если пользователь перешёл на следующий экран — это означает "completeOn: navigate"
    if (currentStepDef.completeOn === 'navigate' && currentStepDef.screen !== screen) {
      // Advance до следующего шага этого экрана
      // Находим первый шаг для текущего экрана начиная с текущего
      let idx = step
      while (idx < TUTORIAL_STEPS.length && TUTORIAL_STEPS[idx].screen !== screen) {
        idx++
      }
      if (idx < TUTORIAL_STEPS.length) {
        localStorage.setItem('beercraft_tutorial_step', String(idx))
        refreshTutorial()
      }
    }
  }, [screen, refreshTutorial])

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-brown-950 flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-xs">
          <div className="text-6xl">🚫</div>
          <h1 className="text-cream-100 text-xl font-black">Аккаунт заблокирован</h1>
          <p className="text-cream-200 text-sm opacity-70 leading-relaxed">
            Ваш аккаунт был заблокирован администратором.
            Если вы считаете, что это ошибка — обратитесь к администратору.
          </p>
          <div className="bg-brown-900 border border-brown-800 rounded-xl px-4 py-3">
            <p className="text-amber-400 text-xs font-semibold">Поддержка</p>
            <p className="text-cream-200 text-sm mt-1 opacity-70">@beercraft_support</p>
          </div>
        </div>
      </div>
    )
  }

  if (showOnboarding === null) {
    return (
      <div className="min-h-screen bg-brown-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-bounce">🍺</div>
          <p className="text-cream-200 text-sm opacity-60 animate-pulse">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />
  }

  return (
    <div className="pb-16">
      {screen === 'home' && (
        <>
          <HomeScreen
            onBrew={handleStartBrew}
            onGoMarket={() => setScreen('market')}
          />
          {brewError && (
            <div className="fixed top-4 left-4 right-4 bg-red-950 border border-red-700 rounded-xl px-4 py-3 z-50 shadow-xl">
              <p className="text-red-300 text-sm font-semibold">{brewError}</p>
              <button className="text-red-400 text-xs underline mt-1" onClick={() => setBrewError(null)}>
                Закрыть
              </button>
            </div>
          )}
        </>
      )}

      {screen === 'recipe' && (
        <RecipeConstructor
          onBack={() => setScreen('home')}
          onBrew={handleBrew}
          onGoMarket={() => setScreen('market')}
          brewing={brewing}
          initialStyleKey={recipeStyleKey}
        />
      )}

      {screen === 'brewing' && batchId && (
        <BrewingGame
          batchId={batchId}
          onDone={() => { setBatchId(null); setScreen('home') }}
        />
      )}

      {screen === 'styles'  && <StylesScreen  onBrew={handleStartBrew} onGoMarket={() => setScreen('market')} />}
      {screen === 'market'  && <MarketScreen  onBack={() => setScreen('home')} />}
      {screen === 'duel'    && <DuelScreen />}
      {screen === 'profile' && <ProfileScreen onBack={() => setScreen('home')} />}

      {showNav && <BottomNav current={screen} onChange={setScreen} />}

      {/* Туториал — показывается поверх всего */}
      <TutorialHint
        key={tutorialTick}
        step={tutorialStep}
        onAdvance={refreshTutorial}
        userLevel={userLevel}
        totalSteps={TUTORIAL_STEPS.length}
        currentIndex={getTutorialStep()}
      />
    </div>
  )
}
