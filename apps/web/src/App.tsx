import { useState } from 'react'
import { HomeScreen } from './screens/HomeScreen'
import { RecipeConstructor } from './screens/recipe/RecipeConstructor'
import './App.css'

type Screen = 'home' | 'recipe'

function App() {
  const [screen, setScreen] = useState<Screen>('home')

  if (screen === 'recipe') {
    return (
      <RecipeConstructor
        onBack={() => setScreen('home')}
        onSave={() => alert('Рецепт сохранён!')}
        onBrew={(recipe) => {
          console.log('Brew recipe:', recipe)
          alert(`Варим! OG будет рассчитана на сервере.`)
        }}
      />
    )
  }

  return <HomeScreen onBrew={() => setScreen('recipe')} />
}

export default App
