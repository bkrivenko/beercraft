import { useState, useEffect, useCallback } from 'react'
import { useTelegram } from '../telegram/useTelegram'
import { BeerCard } from '../components/BeerCard'
import { useProfile, useBatches } from '../lib/useApi'
import { api, ApiError } from '../lib/api'
import type { Batch, MarketOrder } from '../lib/api'

// ── Скелетон-заглушка ─────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-brown-800 rounded-xl ${className ?? ''}`} />
}

// ── Плашка с готовой партией ──────────────────────────────────────────────────
function ReadyBanner({ batch, onGoMarket }: { batch: Batch; onGoMarket?: () => void }) {
  return (
    <div className="mx-4 mb-3 bg-hop-900 border border-hop-700 rounded-xl px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-hop-400 text-xs font-semibold">🍺 Партия готова!</p>
        <p className="text-cream-100 text-sm font-bold mt-0.5">
          {batch.styleName ?? 'Пиво'} · Кач. {batch.quality ?? '—'}
        </p>
      </div>
      <button
        className="bg-amber-600 text-brown-950 text-xs font-bold px-3 py-2 rounded-lg active:opacity-80"
        onClick={onGoMarket}
      >
        Продать →
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

// ── Детали заказа (нижний лист) ───────────────────────────────────────────────
const STYLE_NAME: Record<string, string> = {
  pale_ale: 'Pale Ale', ipa: 'IPA', stout: 'Stout', hefeweizen: 'Hefeweizen',
  porter: 'Porter', pilsner: 'Pilsner', neipa: 'NEIPA', saison: 'Saison',
  brown: 'Brown Ale', witbier: 'Witbier', lager: 'Lager',
}

function OrderSheet({
  order,
  onClose,
  onBrew,
}: {
  order: MarketOrder
  onClose: () => void
  onBrew: (styleKey: string) => void
}) {
  const c = order.constraints as Record<string, unknown>
  const minQuality = c?.min_quality as number | undefined
  const ibu        = c?.ibu as [number, number] | undefined
  const abv        = c?.abv as [number, number] | undefined
  const srm        = c?.srm as [number, number] | undefined

  const hoursLeft = order.hoursLeft ?? 0
  const timeStr   = hoursLeft > 24
    ? `${Math.floor(hoursLeft / 24)}д ${hoursLeft % 24}ч`
    : `${hoursLeft}ч`

  return (
    <>
      {/* Затемнение */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />
      {/* Лист */}
      <div className="fixed bottom-0 left-0 right-0 bg-brown-900 rounded-t-2xl z-50 pb-8 pt-5 px-5 space-y-4">
        <div className="w-10 h-1 bg-brown-700 rounded-full mx-auto mb-2" />

        {/* Заголовок */}
        <div className="flex items-start justify-between">
          <div>
            {order.isStarter
              ? <p className="text-hop-400 text-xs font-semibold">🎓 Стартовый заказ · без срока</p>
              : <p className="text-amber-400 text-xs font-semibold">📋 Заказ</p>
            }
            <h2 className="text-cream-100 font-bold text-lg">{order.customerName}</h2>
          </div>
          <button className="text-cream-200 opacity-50 text-2xl leading-none" onClick={onClose}>×</button>
        </div>

        {order.isStarter && (
          <div className="bg-hop-900/30 border border-hop-700/40 rounded-xl px-4 py-3">
            <p className="text-hop-300 text-xs leading-relaxed">
              💡 Сварите <strong className="text-cream-100">Pale Ale</strong> и выполните этот заказ — это последний шаг обучения!
              Заказ никуда не пропадёт, пока вы на 1-м уровне.
            </p>
          </div>
        )}

        {/* Стиль */}
        <div className="bg-hop-900/60 border border-hop-800 rounded-xl px-4 py-3">
          <p className="text-hop-400 text-xs font-semibold mb-0.5">Нужен стиль</p>
          <p className="text-cream-100 font-bold text-base">
            {STYLE_NAME[order.styleKey ?? ''] ?? order.styleKey ?? 'Любой'}
          </p>
        </div>

        {/* Требования */}
        <div className="grid grid-cols-2 gap-2">
          {minQuality && (
            <div className="bg-brown-800 rounded-xl px-3 py-2.5 text-center">
              <p className="text-cream-200 text-xs opacity-60">Мин. качество</p>
              <p className="text-cream-100 font-bold">{minQuality}+</p>
            </div>
          )}
          {ibu && (
            <div className="bg-brown-800 rounded-xl px-3 py-2.5 text-center">
              <p className="text-cream-200 text-xs opacity-60">IBU</p>
              <p className="text-cream-100 font-bold">{ibu[0]}–{ibu[1]}</p>
            </div>
          )}
          {abv && (
            <div className="bg-brown-800 rounded-xl px-3 py-2.5 text-center">
              <p className="text-cream-200 text-xs opacity-60">ABV %</p>
              <p className="text-cream-100 font-bold">{abv[0]}–{abv[1]}</p>
            </div>
          )}
          {srm && (
            <div className="bg-brown-800 rounded-xl px-3 py-2.5 text-center">
              <p className="text-cream-200 text-xs opacity-60">SRM (цвет)</p>
              <p className="text-cream-100 font-bold">{srm[0]}–{srm[1]}</p>
            </div>
          )}
        </div>

        {/* Награда и срок */}
        <div className="flex gap-3">
          <div className="flex-1 bg-amber-900/30 border border-amber-700/40 rounded-xl px-4 py-3 text-center">
            <p className="text-amber-400 text-xs opacity-70">Награда</p>
            <p className="text-amber-400 font-bold text-lg">+{order.rewardSoft} 🪙</p>
            <p className="text-hop-400 text-xs">+{order.rewardRep} ⭐</p>
          </div>
          {order.isStarter ? (
            <div className="flex-1 bg-hop-900/30 border border-hop-700/30 rounded-xl px-4 py-3 text-center">
              <p className="text-hop-400 text-xs opacity-70">Срок</p>
              <p className="text-hop-300 font-bold text-base">Без срока</p>
            </div>
          ) : (
            <div className="flex-1 bg-brown-800 rounded-xl px-4 py-3 text-center">
              <p className="text-cream-200 text-xs opacity-60">До дедлайна</p>
              <p className="text-cream-100 font-bold text-lg">{timeStr}</p>
            </div>
          )}
        </div>

        {/* Как выполнить */}
        <div className="bg-brown-800/60 rounded-xl px-4 py-3 space-y-1">
          <p className="text-cream-200 text-xs font-semibold">Как выполнить:</p>
          <p className="text-cream-200 text-xs opacity-70">
            1. Нажми «Варить» → выбери стиль <strong className="text-cream-100">{STYLE_NAME[order.styleKey ?? ''] ?? order.styleKey}</strong>
          </p>
          <p className="text-cream-200 text-xs opacity-70">
            2. Когда партия готова → Рынок → Заказы → «Выполнить»
          </p>
        </div>

        {/* CTA */}
        <button
          className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base active:opacity-80"
          onClick={() => { onClose(); onBrew(order.styleKey ?? '') }}
        >
          🍺 Варить {STYLE_NAME[order.styleKey ?? ''] ?? 'пиво'}
        </button>
      </div>
    </>
  )
}

// ── Попап ускорения варки ─────────────────────────────────────────────────────
function AccelerateModal({
  batch,
  lepreCount,
  onConfirm,
  onClose,
}: {
  batch: Batch
  lepreCount: number
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handle = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e)
      setError(msg.includes('NOT_ENOUGH') ? 'Недостаточно лепреконцев 🍀' : msg)
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-brown-900 border-t border-emerald-700/40 rounded-t-2xl z-50 pb-8 pt-5 px-5">
        <div className="w-10 h-1 bg-brown-700 rounded-full mx-auto mb-5" />

        <div className="space-y-4">
          {/* Иконка и заголовок */}
          <div className="text-center space-y-2">
            <div className="text-5xl">⚡</div>
            <h3 className="text-cream-100 font-black text-xl">Ускорить варку?</h3>
            <p className="text-cream-200 text-sm opacity-70">
              {batch.styleName ?? 'Партия'} мгновенно перейдёт в статус «Готово»
            </p>
          </div>

          {/* Стоимость */}
          <div className="bg-emerald-950/60 border border-emerald-700/40 rounded-xl px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-emerald-300 text-sm font-semibold">Стоимость ускорения</p>
              <p className="text-emerald-400/70 text-xs mt-0.5">Партия завершится с текущим качеством</p>
            </div>
            <div className="text-right">
              <p className="text-emerald-200 font-black text-2xl">1 🍀</p>
              <p className="text-emerald-400/60 text-xs">у вас: {lepreCount}</p>
            </div>
          </div>

          {lepreCount < 1 && (
            <div className="bg-red-950/60 border border-red-700/40 rounded-xl px-4 py-3 text-center">
              <p className="text-red-300 text-sm">Недостаточно лепреконцев</p>
              <p className="text-red-400/60 text-xs mt-1">Получи их в разделе Профиль → Лепреконцы</p>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              className="flex-1 border border-brown-700 text-cream-200 font-bold py-3.5 rounded-2xl text-sm active:opacity-70"
              onClick={onClose}
            >Отмена</button>
            <button
              disabled={lepreCount < 1 || loading}
              className={`flex-1 font-bold py-3.5 rounded-2xl text-sm ${
                lepreCount >= 1 && !loading
                  ? 'bg-emerald-600 text-white active:opacity-80'
                  : 'bg-brown-800 text-cream-200 opacity-50 cursor-not-allowed'
              }`}
              onClick={handle}
            >
              {loading ? '⏳ Ускоряем…' : '⚡ Ускорить — 1 🍀'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Список заказов ────────────────────────────────────────────────────────────
function OrdersSection({ onBrew }: { onBrew: (styleKey: string) => void }) {
  const [orders,  setOrders]  = useState<MarketOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MarketOrder | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.getMarketOrders()
      setOrders(data.items)
    } catch { /* тихо */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="space-y-2">
      {[0,1].map(i => <Skeleton key={i} className="h-16" />)}
    </div>
  )

  if (orders.length === 0) return (
    <p className="text-cream-200 text-sm opacity-50 text-center py-4">
      Заказов нет — они появляются каждые 4 часа
    </p>
  )

  return (
    <>
      <div className="space-y-2">
        {orders.map(o => {
          const hoursLeft = o.hoursLeft ?? 0
          const timeStr   = hoursLeft > 24
            ? `${Math.floor(hoursLeft / 24)}д`
            : `${hoursLeft}ч`

          return (
            <button
              key={o.id}
              className={`w-full rounded-xl px-3 py-3 flex items-center justify-between active:opacity-80 text-left border ${
                o.isStarter
                  ? 'bg-hop-950/40 border-hop-700/60'
                  : 'bg-brown-900 border-brown-800'
              }`}
              onClick={() => setSelected(o)}
            >
              <div className="flex-1 min-w-0">
                {o.isStarter && (
                  <span className="inline-block bg-hop-700/40 text-hop-300 text-xs font-bold px-2 py-0.5 rounded-full mb-1">
                    🎓 Стартовый заказ
                  </span>
                )}
                <p className="text-cream-100 text-sm font-semibold">{o.customerName}</p>
                <p className="text-amber-400 text-xs mt-0.5">
                  {STYLE_NAME[o.styleKey ?? ''] ?? o.styleKey} · мин. {(o.constraints as any)?.min_quality ?? '—'}
                </p>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-cream-100 text-sm font-bold">+{o.rewardSoft} 🪙</p>
                {o.isStarter
                  ? <p className="text-hop-400 text-xs">Без срока</p>
                  : <p className="text-cream-200 text-xs opacity-50">⏳ {timeStr}</p>
                }
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <OrderSheet
          order={selected}
          onClose={() => setSelected(null)}
          onBrew={onBrew}
        />
      )}
    </>
  )
}

// ── Главный экран ─────────────────────────────────────────────────────────────
export function HomeScreen({
  onBrew,
  onGoMarket,
}: {
  onBrew?: (styleKey?: string) => void
  onGoMarket?: () => void
}) {
  const { displayName } = useTelegram()
  const { profile, loading: profileLoading } = useProfile()
  const { batches, loading: batchesLoading, reload: refetchBatches } = useBatches(10_000)
  const [accelBatch, setAccelBatch] = useState<Batch | null>(null)
  const [lepre,      setLepre]      = useState<number | null>(null)

  // Запоминаем что пользователь варил хотя бы раз
  const [hasBrewed, setHasBrewed] = useState(() => localStorage.getItem('beercraft_has_brewed') === 'true')
  useEffect(() => {
    if (batches.length > 0 && !hasBrewed) {
      localStorage.setItem('beercraft_has_brewed', 'true')
      setHasBrewed(true)
    }
  }, [batches.length, hasBrewed])

  // Подгружаем количество лепреконцев
  useEffect(() => {
    api.getMe().then(me => setLepre(me.premiumCurrency)).catch(() => {})
  }, [])

  const handleAccelerate = useCallback(async () => {
    if (!accelBatch) return
    const res = await api.accelerateBatch(accelBatch.id)
    setLepre(res.lepreLeft)
    setAccelBatch(null)
    refetchBatches?.()
  }, [accelBatch, refetchBatches])

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

        {profileLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[0,1,2].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Монеты',    value: (profile?.softCurrency ?? 0).toLocaleString('ru'), icon: '🪙' },
              { label: 'Реп.',      value: String(profile?.reputation ?? 0),                  icon: '⭐' },
              { label: 'Уровень',   value: String(profile?.level ?? 1),                        icon: '🏆' },
              { label: 'Леприк.',   value: lepre !== null ? String(lepre) : '…',              icon: '🍀' },
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

      {/* Готовые партии */}
      {readyBatches.length > 0 && (
        <div className="pt-3">
          {readyBatches.map((b) => (
            <ReadyBanner key={b.id} batch={b} onGoMarket={onGoMarket} />
          ))}
        </div>
      )}

      {/* Активные партии */}
      <section className="px-4 pt-4">
        <h2 className="text-cream-100 font-bold text-sm mb-3 flex items-center gap-2">
          <span className="text-amber-600">🍺</span> Активные партии
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
            activeBatches.length >= 2
              ? 'bg-red-700 text-cream-100'
              : 'bg-amber-600 text-brown-950'
          }`}>
            {activeBatches.length}/2
          </span>
          {activeBatches.length >= 2 && (
            <span className="text-red-400 text-xs opacity-80">лимит достигнут</span>
          )}
        </h2>

        {batchesLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0,1].map((i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : batches.length === 0 && !hasBrewed ? (
          <EmptyBatches onBrew={() => onBrew?.()} />
        ) : activeBatches.length === 0 ? (
          <div className="flex flex-col items-center py-6 space-y-2">
            <span className="text-4xl">😴</span>
            <p className="text-cream-200 text-sm opacity-60">Нет активных варок</p>
            <button
              className="bg-amber-600 text-brown-950 font-bold px-5 py-2 rounded-xl text-sm active:opacity-80"
              onClick={() => onBrew?.()}
            >🍺 Начать новую варку</button>
          </div>
        ) : (
          <div data-tutorial="batch-cards" className="grid grid-cols-2 gap-3">
            {activeBatches.map((b) => (
              <div key={b.id} className="flex flex-col gap-1.5">
                <BeerCard
                  id={b.id}
                  name={b.styleName ?? `Партия ${b.id.slice(-4)}`}
                  styleName={b.styleName}
                  styleKey={(b as any).styleKey ?? null}
                  ibu={b.ibu}
                  abv={b.abv}
                  quality={b.quality}
                  srm={b.srm}
                  status={b.status}
                  readyAt={b.readyAt}
                />
                <button
                  className="w-full bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 text-xs font-bold py-2 rounded-xl active:opacity-70 flex items-center justify-center gap-1.5"
                  onClick={() => setAccelBatch(b)}
                >
                  ⚡ Ускорить <span className="text-emerald-400/70">— 1 🍀</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Активные заказы */}
      <section className="px-4 pt-6">
        <h2 className="text-cream-100 font-bold text-sm mb-3 flex items-center gap-2">
          <span className="text-amber-600">📋</span> Активные заказы
        </h2>
        <OrdersSection onBrew={(styleKey) => onBrew?.(styleKey)} />
      </section>

      {/* Попап ускорения */}
      {accelBatch && (
        <AccelerateModal
          batch={accelBatch}
          lepreCount={lepre ?? 0}
          onConfirm={handleAccelerate}
          onClose={() => setAccelBatch(null)}
        />
      )}

      {/* Кнопка варки */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-4 bg-gradient-to-t from-brown-950 via-brown-950/90 to-transparent">
        <button
          data-tutorial="brew-button"
          className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
          onClick={() => onBrew?.()}
        >
          🍺 Сварить партию
        </button>
      </div>
    </div>
  )
}
