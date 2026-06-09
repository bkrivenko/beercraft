import { useState, useCallback, useEffect } from 'react'
import { HomeScreen }          from './screens/HomeScreen'
import { RecipeConstructor }   from './screens/recipe/RecipeConstructor'
import { BrewingGame }         from './screens/BrewingGame'
import { MarketScreen }        from './screens/MarketScreen'
import { ProfileScreen }       from './screens/ProfileScreen'
import { DuelScreen }          from './screens/DuelScreen'
import { StylesScreen }        from './screens/StylesScreen'
import { OnboardingScreen }    from './screens/OnboardingScreen'
import { api }                 from './lib/api'
import type { StartBatchBody } from './lib/api'
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

  // Онбординг: null = ещё не знаем, true = показывать, false = уже показан
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  // Проверяем флаг онбординга при запуске
  // Приоритет: localStorage (быстро) → сервер (надёжно)
  useEffect(() => {
    const localDone = localStorage.getItem('beercraft_onboarding_done') === 'true'
    if (localDone) {
      // Уже видел локально — не показываем
      setShowOnboarding(false)
      return
    }
    // Проверяем сервер
    api.getMe()
      .then(me => {
        if (me.onboardingDone) {
          // Сервер говорит: уже прошёл — запомним локально и скроем
          localStorage.setItem('beercraft_onboarding_done', 'true')
          setShowOnboarding(false)
        } else {
          // Нужно показать
          setShowOnboarding(true)
        }
      })
      .catch(() => {
        // Ошибка сервера — показываем онбординг (новый пользователь скорее всего)
        setShowOnboarding(true)
      })
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

  // Пока не знаем статус онбординга — показываем заглушку
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

  // Показываем онбординг поверх всего
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
              <button
                className="text-red-400 text-xs underline mt-1"
                onClick={() => setBrewError(null)}
              >
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

      {screen === 'styles'  && <StylesScreen  onBrew={handleStartBrew} />}
      {screen === 'market'  && <MarketScreen  onBack={() => setScreen('home')} />}
      {screen === 'duel'    && <DuelScreen />}
      {screen === 'profile' && <ProfileScreen onBack={() => setScreen('home')} />}

      {showNav && <BottomNav current={screen} onChange={setScreen} />}
    </div>
  )
}
