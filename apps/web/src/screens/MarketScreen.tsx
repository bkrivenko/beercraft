import { useState, useEffect, useCallback } from 'react'
import { api, type MarketOrder, type BatchForSale, type Trend, type SellPrice, type Ingredient, type InventoryItem } from '../lib/api'
import { srmToHex } from '../lib/brewCalc'

type Tab = 'shop' | 'orders' | 'sell' | 'trends'

// ── Иконка тренда ─────────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up')      return <span className="text-hop-400 text-xs">▲</span>
  if (trend === 'down')    return <span className="text-red-400 text-xs">▼</span>
  return <span className="text-cream-200 text-xs opacity-40">—</span>
}

// ── Скелетон ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-brown-800 rounded-xl ${className ?? ''}`} />
}

// ── Таб: Заказы NPC ───────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders]       = useState<MarketOrder[]>([])
  const [batches, setBatches]     = useState<BatchForSale[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<{ order: MarketOrder; batch: BatchForSale } | null>(null)
  const [confirming, setConfirm]  = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, b] = await Promise.all([api.getMarketOrders(), api.getReadyBatches()])
      setOrders(o.items)
      setBatches(b.items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleFulfill = async () => {
    if (!selected) return
    setConfirm(false)
    try {
      const r = await api.fulfillOrder(selected.order.id, selected.batch.id)
      showToast(`✅ Заказ выполнен! +${r.rewardSoft} 🪙 +${r.rewardRep} ⭐`)
      setSelected(null)
      await load()
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Ошибка'}`)
    }
  }

  if (loading) return (
    <div className="space-y-3 px-4 pt-4">
      {[0,1,2].map(i => <Skeleton key={i} className="h-28" />)}
    </div>
  )

  if (orders.length === 0) return (
    <div className="flex flex-col items-center py-12 space-y-2">
      <span className="text-4xl">📋</span>
      <p className="text-cream-200 text-sm opacity-60">Новые заказы появятся через несколько часов</p>
    </div>
  )

  return (
    <div className="px-4 pt-4 space-y-3 pb-6">
      {toast && (
        <div className="fixed top-4 left-4 right-4 bg-hop-900 border border-hop-700 text-cream-100 text-sm px-4 py-3 rounded-xl z-50 text-center">
          {toast}
        </div>
      )}

      {orders.map(order => {
        // Подходящие партии
        const matching = batches.filter(b => {
          if (order.styleKey && b.styleKey !== order.styleKey) return false
          const c = order.constraints as any
          if (c.min_quality && (b.quality ?? 0) < c.min_quality) return false
          if (c.ibu && b.ibu != null && (b.ibu < c.ibu[0] || b.ibu > c.ibu[1])) return false
          return true
        })

        return (
          <div key={order.id} className="bg-brown-900 border border-brown-800 rounded-xl p-4 space-y-3">
            {/* Заголовок */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-cream-100 font-bold text-sm">{order.customerName}</p>
                <p className="text-amber-400 text-xs mt-0.5">
                  {order.styleKey ?? 'Любой стиль'}
                  {order.constraints && (order.constraints as any).min_quality &&
                    ` · кач. ≥${(order.constraints as any).min_quality}`
                  }
                </p>
              </div>
              <div className="text-right">
                <p className="text-cream-100 text-sm font-bold">+{order.rewardSoft} 🪙</p>
                <p className="text-hop-400 text-xs">+{order.rewardRep} ⭐</p>
              </div>
            </div>

            {/* Дедлайн + спрос */}
            <div className="flex items-center gap-3 text-xs text-cream-200 opacity-60">
              <span>⏳ {order.hoursLeft}ч</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <TrendIcon trend={order.trend} />
                спрос ×{order.demandMult}
              </span>
            </div>

            {/* Подходящие партии */}
            {matching.length === 0 ? (
              <p className="text-cream-200 text-xs opacity-50 italic">Нет подходящих партий на складе</p>
            ) : (
              <div className="space-y-2">
                <p className="text-cream-200 text-xs opacity-60">Подходит:</p>
                {matching.map(b => (
                  <button
                    key={b.id}
                    className={`w-full flex items-center justify-between p-2 rounded-lg border transition-colors ${
                      selected?.batch.id === b.id && selected.order.id === order.id
                        ? 'border-amber-600 bg-amber-600/10'
                        : 'border-brown-700 active:opacity-70'
                    }`}
                    onClick={() => setSelected({ order, batch: b })}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full border border-brown-700"
                        style={{ background: srmToHex(b.srm ?? 8) }}
                      />
                      <div className="text-left">
                        <p className="text-cream-100 text-xs font-semibold">{b.styleName ?? 'Пиво'}</p>
                        <p className="text-cream-200 text-xs opacity-60">Кач. {b.quality} · ABV {b.abv}%</p>
                      </div>
                    </div>
                    {selected?.batch.id === b.id && selected.order.id === order.id && (
                      <span className="text-amber-600 text-sm">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {selected?.order.id === order.id && (
              <button
                className="w-full bg-amber-600 text-brown-950 font-bold py-2.5 rounded-xl active:opacity-80"
                onClick={() => setConfirm(true)}
              >
                Выполнить заказ
              </button>
            )}
          </div>
        )
      })}

      {/* Confirm sheet */}
      {confirming && selected && (
        <div className="fixed inset-0 z-40 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirm(false)} />
          <div className="relative w-full bg-brown-900 border-t border-brown-800 rounded-t-2xl p-6 space-y-4">
            <h3 className="text-cream-100 font-bold text-base">Подтвердить выполнение</h3>
            <div className="space-y-1 text-sm">
              <p className="text-cream-200">Заказчик: <span className="text-cream-100">{selected.order.customerName}</span></p>
              <p className="text-cream-200">Партия: <span className="text-cream-100">{selected.batch.styleName} · кач. {selected.batch.quality}</span></p>
              <p className="text-hop-400 font-bold">Награда: +{selected.order.rewardSoft} 🪙 +{selected.order.rewardRep} ⭐</p>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 border border-brown-700 text-cream-100 py-3 rounded-xl active:opacity-70" onClick={() => setConfirm(false)}>Отмена</button>
              <button className="flex-1 bg-amber-600 text-brown-950 font-bold py-3 rounded-xl active:opacity-80" onClick={handleFulfill}>Подтвердить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Таб: Продажа ──────────────────────────────────────────────────────────────
function SellTab() {
  const [batches, setBatches]     = useState<BatchForSale[]>([])
  const [loading, setLoading]     = useState(true)
  const [priceInfo, setPriceInfo] = useState<SellPrice | null>(null)
  const [confirming, setConfirm]  = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const b = await api.getReadyBatches()
      setBatches(b.items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const handleSelectBatch = async (b: BatchForSale) => {
    try {
      const price = await api.getSellPrice(b.id)
      setPriceInfo(price)
      setConfirm(true)
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Ошибка'}`)
    }
  }

  const handleSell = async () => {
    if (!priceInfo) return
    setConfirm(false)
    try {
      const r = await api.sellBatch(priceInfo.batchId)
      showToast(`✅ Продано за ${r.sellPrice} 🪙`)
      setPriceInfo(null)
      await load()
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Ошибка'}`)
    }
  }

  if (loading) return (
    <div className="space-y-3 px-4 pt-4">{[0,1].map(i => <Skeleton key={i} className="h-24" />)}</div>
  )

  if (batches.length === 0) return (
    <div className="flex flex-col items-center py-12 space-y-2">
      <span className="text-4xl">🫙</span>
      <p className="text-cream-200 text-sm opacity-60">Нет готовых партий для продажи</p>
    </div>
  )

  return (
    <div className="px-4 pt-4 space-y-3 pb-6">
      {toast && (
        <div className="fixed top-4 left-4 right-4 bg-hop-900 border border-hop-700 text-cream-100 text-sm px-4 py-3 rounded-xl z-50 text-center">
          {toast}
        </div>
      )}
      <p className="text-cream-200 text-xs opacity-60">Выберите партию для продажи</p>
      {batches.map(b => (
        <button
          key={b.id}
          className="w-full bg-brown-900 border border-brown-800 rounded-xl p-4 text-left active:opacity-80"
          onClick={() => handleSelectBatch(b)}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl border border-brown-700 flex items-center justify-center text-xl"
              style={{ background: srmToHex(b.srm ?? 8) }}
            >🍺</div>
            <div className="flex-1">
              <p className="text-cream-100 font-bold text-sm">{b.styleName ?? 'Пиво'}</p>
              <p className="text-cream-200 text-xs opacity-70">
                Кач. {b.quality} · ABV {b.abv}% · IBU {b.ibu}
              </p>
            </div>
            <div className="text-right">
              {b.sellPrice && (
                <p className="text-amber-400 font-bold text-base">{b.sellPrice} 🪙</p>
              )}
              <p className="text-cream-200 text-xs opacity-50">продать →</p>
            </div>
          </div>
        </button>
      ))}

      {/* Confirm sheet */}
      {confirming && priceInfo && (
        <div className="fixed inset-0 z-40 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirm(false)} />
          <div className="relative w-full bg-brown-900 border-t border-brown-800 rounded-t-2xl p-6 space-y-4">
            <h3 className="text-cream-100 font-bold text-base">Продать партию</h3>
            <div className="bg-brown-800 rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between text-cream-200">
                <span>Базовая цена</span><span className="text-cream-100">{priceInfo.basePrice} 🪙</span>
              </div>
              <div className="flex justify-between text-cream-200">
                <span>Качество ×{priceInfo.qualityMult}</span>
                <span className={priceInfo.qualityMult >= 1 ? 'text-hop-400' : 'text-red-400'}>×{priceInfo.qualityMult}</span>
              </div>
              <div className="flex justify-between text-cream-200">
                <span>Спрос</span>
                <span className={priceInfo.demandMult >= 1 ? 'text-hop-400' : 'text-red-400'}>×{priceInfo.demandMult}</span>
              </div>
              <div className="flex justify-between text-cream-200">
                <span>Репутация</span><span className="text-hop-400">×{priceInfo.reputationMult}</span>
              </div>
              <div className="border-t border-brown-700 pt-2 flex justify-between">
                <span className="text-cream-100 font-bold">Итого</span>
                <span className="text-amber-400 font-bold text-base">{priceInfo.sellPrice} 🪙</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 border border-brown-700 text-cream-100 py-3 rounded-xl active:opacity-70" onClick={() => setConfirm(false)}>Отмена</button>
              <button className="flex-1 bg-amber-600 text-brown-950 font-bold py-3 rounded-xl active:opacity-80" onClick={handleSell}>Продать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Таб: Тренды ───────────────────────────────────────────────────────────────
function TrendsTab() {
  const [trends, setTrends] = useState<Trend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTrends().then(r => setTrends(r.items)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-2 px-4 pt-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>

  return (
    <div className="px-4 pt-4 pb-6 space-y-2">
      <p className="text-cream-200 text-xs opacity-60 mb-3">Текущий спрос меняется каждые сутки</p>
      {trends.map(t => (
        <div key={t.styleKey} className="flex items-center justify-between bg-brown-900 border border-brown-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <TrendIcon trend={t.trend} />
            <span className="text-cream-100 text-sm">{t.styleName}</span>
          </div>
          <span className={`font-bold text-sm ${
            t.trend === 'up' ? 'text-hop-400' : t.trend === 'down' ? 'text-red-400' : 'text-cream-200'
          }`}>×{t.demandMult}</span>
        </div>
      ))}
    </div>
  )
}

// ── Главный экран Э-5 ─────────────────────────────────────────────────────────
// ── Таб: Магазин ингредиентов ─────────────────────────────────────────────────
function ShopTab() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [inventory,   setInventory]   = useState<InventoryItem[]>([])
  const [coins,       setCoins]       = useState<number | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [buying,      setBuying]      = useState<string | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)
  const [qty,         setQty]         = useState<Record<string, number>>({})

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ing, inv, me] = await Promise.all([
        api.getIngredients(),
        api.getInventory(),
        api.getMe(),
      ])
      setIngredients(ing.items)
      setInventory(inv.items)
      setCoins(me.softCurrency)
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Ошибка загрузки'}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stockMap = Object.fromEntries(inventory.map(i => [i.key, i.quantity]))

  const TYPE_ICON: Record<string, string> = {
    malt: '🌾', hop: '🌿', yeast: '🧫', water: '💧', adjunct: '🍊',
  }

  function getIngredientImage(type: string, key: string): string | null {
    if (type === 'malt')  return `/assets/malts/${key}.webp`
    if (type === 'hop')   return `/assets/hops/${key}.webp`
    if (type === 'yeast') return `/assets/yeasts/${key}.webp`
    return null
  }
  const TYPE_LABEL: Record<string, string> = {
    malt: 'Солод', hop: 'Хмель', yeast: 'Дрожжи', water: 'Вода', adjunct: 'Добавки',
  }

  // Группируем по типу
  // Вода безлимитная — не показываем в магазине
  const grouped = ingredients
    .filter(i => i.type !== 'water')
    .reduce<Record<string, Ingredient[]>>((acc, i) => {
      const t = i.type ?? 'other';
      (acc[t] = acc[t] ?? []).push(i)
      return acc
    }, {})

  async function handleBuy(key: string, price: number) {
    const amount = qty[key] ?? 1
    setBuying(key)
    try {
      await api.purchase(key, amount)
      showToast(`✅ Куплено! -${price * amount} 🪙`)
      await load()
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Ошибка покупки'}`)
    } finally {
      setBuying(null)
    }
  }

  if (loading) return (
    <div className="px-4 pt-4 space-y-3">
      {[0,1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
    </div>
  )

  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      {toast && (
        <div className="fixed top-20 left-4 right-4 bg-brown-900 border border-brown-700 rounded-xl px-4 py-3 z-50 text-center">
          <p className="text-cream-100 text-sm font-semibold">{toast}</p>
        </div>
      )}

      {/* Баланс */}
      {coins != null && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-cream-200 text-sm">Баланс</span>
          <span className="text-amber-400 font-bold text-lg">{coins.toLocaleString('ru')} 🪙</span>
        </div>
      )}

      {/* Склад — что уже есть */}
      {inventory.length > 0 && (
        <div>
          <h3 className="text-cream-200 text-xs font-semibold uppercase tracking-wider mb-2">📦 На складе</h3>
          <div className="grid grid-cols-2 gap-2">
            {inventory.filter(item => item.type !== 'water').map(item => {
              const img = getIngredientImage(item.type ?? '', item.key)
              return (
                <div key={item.key} className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  {img ? (
                    <img src={img} alt={item.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <span className="text-lg">{TYPE_ICON[item.type ?? ''] ?? '📦'}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-cream-100 text-xs font-semibold truncate">{item.name}</p>
                    <p className="text-amber-400 text-xs">{item.quantity} {item.unit}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {inventory.length === 0 && !loading && (
        <div className="text-center py-4">
          <p className="text-cream-200 text-sm opacity-60">Склад пуст — купи ингредиенты ниже</p>
        </div>
      )}

      {/* Каталог по типам */}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <h3 className="text-cream-200 text-xs font-semibold uppercase tracking-wider mb-2">
            {TYPE_ICON[type]} {TYPE_LABEL[type] ?? type}
          </h3>
          <div className="space-y-2">
            {items.map(ing => {
              const stock = stockMap[ing.key] ?? 0
              const amount = qty[ing.key] ?? 1
              const img = getIngredientImage(ing.type, ing.key)
              return (
                <div key={ing.key} className="bg-brown-900 border border-brown-800 rounded-xl overflow-hidden">
                  {img && (
                    <img src={img} alt={ing.name} className="w-full h-24 object-cover" />
                  )}
                  <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-cream-100 font-semibold text-sm">{ing.name}</p>
                      <p className="text-amber-400 text-xs mt-0.5">{ing.basePrice} 🪙 / {ing.unit}</p>
                      {stock > 0 && (
                        <p className="text-hop-400 text-xs mt-0.5">На складе: {stock} {ing.unit}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Количество */}
                      <div className="flex items-center gap-1">
                        <button
                          className="w-7 h-7 bg-brown-800 text-cream-100 rounded-lg text-sm active:opacity-70"
                          onClick={() => setQty(q => ({ ...q, [ing.key]: Math.max(1, (q[ing.key] ?? 1) - 1) }))}
                        >−</button>
                        <span className="text-cream-100 text-sm w-5 text-center">{amount}</span>
                        <button
                          className="w-7 h-7 bg-brown-800 text-cream-100 rounded-lg text-sm active:opacity-70"
                          onClick={() => setQty(q => ({ ...q, [ing.key]: (q[ing.key] ?? 1) + 1 }))}
                        >+</button>
                      </div>
                      <button
                        disabled={buying === ing.key || (coins != null && coins < ing.basePrice * amount)}
                        className="bg-amber-600 text-brown-950 text-xs font-bold px-3 py-2 rounded-lg active:opacity-80 disabled:opacity-40"
                        onClick={() => handleBuy(ing.key, ing.basePrice)}
                      >
                        {buying === ing.key ? '⏳' : 'Купить'}
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {ingredients.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-5xl mb-3">📭</p>
          <p className="text-cream-200 text-sm opacity-60">Каталог ингредиентов пуст</p>
          <p className="text-cream-200 text-xs opacity-40 mt-1">Сервер загружает данные…</p>
        </div>
      )}
    </div>
  )
}

export function MarketScreen({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = useState<Tab>('shop')

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'shop',   label: '🛒 Магазин' },
    { key: 'orders', label: '📋 Заказы' },
    { key: 'sell',   label: '💰 Продажа' },
    { key: 'trends', label: '📈 Тренды' },
  ]

  return (
    <div className="min-h-screen bg-brown-950 flex flex-col">
      <header className="bg-brown-900 border-b border-brown-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <button className="text-cream-200 text-lg active:opacity-60" onClick={onBack}>‹</button>
          <h1 className="text-cream-100 font-bold text-base">Рынок</h1>
        </div>
        <div className="flex gap-1 mt-3 bg-brown-800 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition-colors ${
                tab === t.key ? 'bg-amber-600 text-brown-950' : 'text-cream-200 active:opacity-70'
              }`}
              onClick={() => setTab(t.key)}
            >{t.label}</button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-16">
        {tab === 'shop'   && <ShopTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'sell'   && <SellTab />}
        {tab === 'trends' && <TrendsTab />}
      </div>
    </div>
  )
}
