import { useState } from 'react'
import { HomeScreen }        from './screens/HomeScreen'
import { RecipeConstructor } from './screens/recipe/RecipeConstructor'
import { MarketScreen }      from './screens/MarketScreen'
import { ProfileScreen }     from './screens/ProfileScreen'
import './App.css'

type Screen = 'home' | 'recipe' | 'market' | 'profile'

// ── Bottom Navigation ─────────────────────────────────────────────────────────
const NAV_ITEMS: Array<{ key: Screen; icon: string; label: string }> = [
  { key: 'home',    icon: '🍺', label: 'Пивоварня' },
  { key: 'market',  icon: '💰', label: 'Рынок'     },
  { key: 'profile', icon: '👤', label: 'Профиль'   },
]

function BottomNav({ current, onChange }: { current: Screen; onChange: (s: Screen) => void }) {
  const activeKey = current === 'recipe' ? 'home' : current
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
  const [screen, setScreen] = useState<Screen>('home')

  const showNav = screen !== 'recipe'

  return (
    <div className="pb-16">   {/* отступ под BottomNav */}
      {screen === 'home' && (
        <HomeScreen
          onBrew={() => setScreen('recipe')}
          onMarket={() => setScreen('market')}
          onProfile={() => setScreen('profile')}
        />
      )}
      {screen === 'recipe' && (
        <RecipeConstructor
          onBack={() => setScreen('home')}
          onSave={() => { alert('Рецепт сохранён!'); setScreen('home') }}
          onBrew={(recipe) => {
            console.log('Brew recipe:', recipe)
            setScreen('home')
          }}
        />
      )}
      {screen === 'market'  && <MarketScreen  onBack={() => setScreen('home')} />}
      {screen === 'profile' && <ProfileScreen onBack={() => setScreen('home')} />}

      {showNav && <BottomNav current={screen} onChange={setScreen} />}
    </div>
  )
}
