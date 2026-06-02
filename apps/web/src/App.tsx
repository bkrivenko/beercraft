import './App.css'

const palette = [
  { name: 'brown-950', hex: '#3B1F0A', label: 'Тёмно-коричневый', bg: 'bg-brown-950', text: 'text-cream-100' },
  { name: 'brown-900', hex: '#4e2a0e', label: 'Коричневый 900',   bg: 'bg-brown-900', text: 'text-cream-100' },
  { name: 'brown-800', hex: '#6b3a14', label: 'Коричневый 800',   bg: 'bg-brown-800', text: 'text-cream-100' },
  { name: 'amber-600', hex: '#C8860A', label: 'Янтарный',         bg: 'bg-amber-600', text: 'text-brown-950' },
  { name: 'amber-500', hex: '#e09a10', label: 'Янтарный 500',     bg: 'bg-amber-500', text: 'text-brown-950' },
  { name: 'amber-400', hex: '#f0b030', label: 'Янтарный 400',     bg: 'bg-amber-400', text: 'text-brown-950' },
  { name: 'cream-100', hex: '#F5E6C8', label: 'Кремовый',         bg: 'bg-cream-100', text: 'text-brown-950' },
  { name: 'cream-200', hex: '#edd9a8', label: 'Кремовый 200',     bg: 'bg-cream-200', text: 'text-brown-950' },
  { name: 'hop-900',   hex: '#1C3A1E', label: 'Зелёный хмель',    bg: 'bg-hop-900',   text: 'text-cream-100' },
  { name: 'hop-700',   hex: '#2e6232', label: 'Хмель 700',        bg: 'bg-hop-700',   text: 'text-cream-100' },
  { name: 'hop-400',   hex: '#5aaa5e', label: 'Хмель 400',        bg: 'bg-hop-400',   text: 'text-brown-950' },
]

function App() {
  return (
    <main className="min-h-screen bg-brown-950 p-8">
      <h1 className="text-cream-100 text-2xl font-bold mb-2">🍺 BeerCraft</h1>
      <p className="text-amber-600 mb-8 text-sm">Цветовая палитра</p>

      <div className="grid grid-cols-2 gap-3 max-w-sm">
        {palette.map(({ name, hex, label, bg, text }) => (
          <div key={name} className={`${bg} ${text} rounded-lg p-4`}>
            <div className="font-mono text-xs opacity-70">{hex}</div>
            <div className="font-semibold text-sm mt-1">{label}</div>
            <div className="font-mono text-xs opacity-50 mt-0.5">{name}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 max-w-sm space-y-3">
        <p className="text-cream-100 text-xs opacity-50 mb-2">Примеры компонентов</p>

        <button className="w-full bg-amber-600 hover:bg-amber-500 text-brown-950 font-bold py-3 rounded-xl transition-colors">
          Сварить партию
        </button>

        <button className="w-full bg-hop-900 hover:bg-hop-700 text-cream-100 font-bold py-3 rounded-xl border border-hop-700 transition-colors">
          Рынок заказов
        </button>

        <div className="bg-brown-900 border border-brown-800 rounded-xl p-4">
          <div className="text-amber-400 font-bold text-sm">Pale Ale</div>
          <div className="text-cream-200 text-xs mt-1">IBU 35 · ABV 5.2% · Качество 87</div>
          <div className="mt-2 h-1.5 rounded-full bg-brown-800">
            <div className="h-1.5 rounded-full bg-amber-600 w-[87%]" />
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
