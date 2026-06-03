import { useTelegram } from '../telegram/useTelegram'
import { BeerCard } from '../components/BeerCard'
import { useProfile, useBatches } from '../lib/useApi'
import type { Batch } from '../lib/api'

// ── Скелетон-заглушка ─────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-brown-800 rounded-xl ${className ?? ''}`} />
}

// ── Заказы (мок пока нет API заказов) ────────────────────────────────────────
const MOCK_ORDERS = [
  { id: 1, customer: 'Паб «Хмель»',  style: 'IPA',   reward: 180, daysLeft: 2 },
  { id: 2, customer: 'Бар «Солод»',  style: 'Lager', reward: 120, daysLeft: 5 },
]

// ── Плашка с готовой партией ──────────────────────────────────────────────────
function ReadyBanner({ batch }: { batch: Batch }) {
  return (
    <div className="mx-4 mb-3 bg-hop-900 border border-hop-700 rounded-xl px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-hop-400 text-xs font-semibold">🍺 Партия готова!</p>
        <p className="text-cream-100 text-sm font-bold mt-0.5">
          {batch.styleName ?? 'Пиво'} · Кач. {batch.quality ?? '—'}
        </p>
      </div>
      <button className="bg-amber-600 text-brown-950 text-xs font-bold px-3 py-2 rounded-lg active:opacity-80">
        Забрать
      </button>
    </div>
  )
}

// ── Пустое состояние ──────────────────────────────────────────────────────────
function EmptyBatches({ onBrew }: { onBrew?: () => void }) {
  return (
    <div className="flex flex-col items-center py-8 space-y-3">
      <span className="text-5xl">🫙</span>
      <p className="text-cream-200 text-sm opacity-60">Ещё не было ни одной варки</p>
      <button
        className="bg-amber-600 text-brown-950 font-bold px-6 py-2.5 rounded-xl active:opacity-80"
        onClick={onBrew}
      >
        🍺 Сварить первую партию
      </button>
    </div>
  )
}

// ── Главный экран ─────────────────────────────────────────────────────────────
export function HomeScreen({ onBrew }: { onBrew?: () => void }) {
  const { displayName } = useTelegram()
  const { profile, loading: profileLoading } = useProfile()
  const { batches, loading: batchesLoading } = useBatches(10_000)

  const readyBatches  = batches.filter((b) => b.status === 'ready')
  const activeBatches = batches.filter((b) => b.status !== 'ready' && b.status !== 'sold')

  return (
    <div className="min-h-screen bg-brown-950 pb-40">

      {/* Шапка */}
      <header className="bg-brown-900 border-b border-brown-800 px-4 py-4">
        <div className="mb-3">
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">
            Добро пожаловать
          </p>
          <h1 className="text-cream-100 text-xl font-bold">
            {displayName} 👋
          </h1>
        </div>

        {/* Статы */}
        {profileLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[0,1,2].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Монеты',    value: (profile?.softCurrency ?? 0).toLocaleString('ru'), icon: '🪙' },
              { label: 'Репутация', value: String(profile?.reputation ?? 0),                  icon: '⭐' },
              { label: 'Уровень',   value: String(profile?.level ?? 1),                        icon: '🏆' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-brown-800 rounded-xl p-2.5 text-center">
                <div className="text-lg">{icon}</div>
                <div className="text-cream-100 font-bold text-sm leading-tight">{value}</div>
                <div className="text-cream-200 text-xs opacity-50">{label}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Баннеры готовых партий */}
      {readyBatches.length > 0 && (
        <div className="pt-3">
          {readyBatches.map((b) => <ReadyBanner key={b.id} batch={b} />)}
        </div>
      )}

      {/* Активные партии */}
      <section className="px-4 pt-4">
        <h2 className="text-cream-100 font-bold text-sm mb-3 flex items-center gap-2">
          <span className="text-amber-600">🍺</span> Активные партии
          {activeBatches.length > 0 && (
            <span className="bg-amber-600 text-brown-950 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {activeBatches.length}
            </span>
          )}
        </h2>

        {batchesLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0,1].map((i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : activeBatches.length === 0 ? (
          <EmptyBatches onBrew={onBrew} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {activeBatches.map((b) => (
              <BeerCard
                key={b.id}
                id={b.id}
                name={b.styleName ?? `Партия ${b.id.slice(-4)}`}
                styleName={b.styleName}
                ibu={b.ibu}
                abv={b.abv}
                quality={b.quality}
                srm={b.srm}
                status={b.status}
                readyAt={b.readyAt}
              />
            ))}
          </div>
        )}
      </section>

      {/* Активные заказы */}
      <section className="px-4 pt-6">
        <h2 className="text-cream-100 font-bold text-sm mb-3 flex items-center gap-2">
          <span className="text-amber-600">📋</span> Активные заказы
        </h2>
        <div className="space-y-2">
          {MOCK_ORDERS.map((o) => (
            <div key={o.id} className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-3 flex items-center justify-between">
              <div>
                <p className="text-cream-100 text-sm font-semibold">{o.customer}</p>
                <p className="text-amber-400 text-xs mt-0.5">{o.style}</p>
              </div>
              <div className="text-right">
                <p className="text-cream-100 text-sm font-bold">+{o.reward} 🪙</p>
                <p className="text-cream-200 text-xs opacity-50">⏳ {o.daysLeft}д</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Кнопка — над BottomNav */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-4 bg-gradient-to-t from-brown-950 via-brown-950/90 to-transparent">
        <button
          className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
          onClick={onBrew}
        >
          🍺 Сварить партию
        </button>
      </div>
    </div>
  )
}
