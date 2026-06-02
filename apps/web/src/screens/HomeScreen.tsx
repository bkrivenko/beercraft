import { useTelegram } from '../telegram/useTelegram'
import { BeerCard } from '../components/BeerCard'

// Моковые данные — до подключения реального API
const MOCK_BATCHES = [
  { id: 1, name: 'Утренний Пейл', style: 'Pale Ale',   ibu: 35, abv: 5.2, quality: 87, status: 'ready'       as const },
  { id: 2, name: 'Тёмный Мюнхен', style: 'Dunkel',     ibu: 18, abv: 4.8, quality: 72, status: 'fermenting'  as const },
  { id: 3, name: 'Хмельной IPA',  style: 'West Coast IPA', ibu: 65, abv: 6.8, quality: 94, status: 'conditioning' as const },
]

export function HomeScreen({ onBrew }: { onBrew?: () => void }) {
  const { displayName } = useTelegram()

  return (
    <div className="min-h-screen bg-brown-950 pb-8">
      {/* Шапка */}
      <header className="bg-brown-900 border-b border-brown-800 px-4 py-4">
        <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-0.5">
          Добро пожаловать
        </p>
        <h1 className="text-cream-100 text-xl font-bold">
          Привет, {displayName}! 👋
        </h1>
        <p className="text-cream-200 text-xs mt-1 opacity-60">
          Твоя пивоварня ждёт
        </p>
      </header>

      {/* Статистика */}
      <section className="grid grid-cols-3 gap-2 px-4 py-4">
        {[
          { label: 'Монеты',     value: '1 200', icon: '🪙' },
          { label: 'Репутация',  value: '340',   icon: '⭐' },
          { label: 'Уровень',    value: '3',     icon: '🏆' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-brown-900 border border-brown-800 rounded-xl p-3 text-center">
            <div className="text-xl">{icon}</div>
            <div className="text-cream-100 font-bold text-base leading-tight">{value}</div>
            <div className="text-cream-200 text-xs opacity-60">{label}</div>
          </div>
        ))}
      </section>

      {/* Партии */}
      <section className="px-4">
        <h2 className="text-cream-100 font-bold text-sm mb-3 flex items-center gap-2">
          <span className="text-amber-600">🍺</span> Мои партии
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {MOCK_BATCHES.map(batch => (
            <BeerCard key={batch.id} {...batch} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="px-4 pt-4">
        <button
          className="w-full bg-amber-600 text-brown-950 font-bold py-3 rounded-xl active:opacity-80"
          onClick={onBrew}
        >
          🍺 Сварить партию
        </button>
      </div>
    </div>
  )
}
