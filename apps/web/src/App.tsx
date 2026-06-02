import { useState } from 'react'
import { HomeScreen }         from './screens/HomeScreen'
import { RecipeConstructor }  from './screens/recipe/RecipeConstructor'
import { MarketScreen }       from './screens/MarketScreen'
import './App.css'

type Screen = 'home' | 'recipe' | 'market'

function App() {
  const [screen, setScreen] = useState<Screen>('home')

  if (screen === 'recipe') {
    return (
      <RecipeConstructor
        onBack={() => setScreen('home')}
        onSave={() => alert('Рецепт сохранён!')}
        onBrew={(recipe) => {
          console.log('Brew recipe (server will calc):', recipe)
          alert('Варим! Финальный расчёт — на сервере.')
          setScreen('home')
        }}
      />
    )
  }

  if (screen === 'market') {
    return <MarketScreen onBack={() => setScreen('home')} />
  }

  return (
    <HomeScreen
      onBrew={() => setScreen('recipe')}
      onMarket={() => setScreen('market')}
    />
  )
}

export default App
