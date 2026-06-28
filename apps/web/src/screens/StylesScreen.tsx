/**
 * Экран «Рецепты» — мои рецепты + магазин рецептов + каталог стилей
 */

import { useState, useEffect, useMemo } from 'react'
import { srmToHex } from '../lib/brewCalc'
import { getBeerImage } from '../components/BeerCard'
import { api, type OwnedRecipe, type RecipeShopItem } from '../lib/api'
import {
  BEER_STYLES,
  STYLE_RECIPES,
  YEASTS,
  type StyleData,
} from '../lib/contentData'

// ── Вспомогательные ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-brown-800 rounded-xl ${className ?? ''}`} />
}

function fmtRange(r?: [number, number], decimals = 0): string {
  if (!r) return '—'
  const fmt = (v: number) => decimals > 0 ? v.toFixed(decimals) : String(v)
  return `${fmt(r[0])}–${fmt(r[1])}`
}

const DIFFICULTY_LABEL = ['', '⭐ Лёгкий', '⭐⭐ Средний', '⭐⭐⭐ Сложный', '⭐⭐⭐⭐ Эксперт']
const TIMING_LABEL: Record<string, string> = {
  bittering: '60 мин', flavor: '15 мин', aroma: '5 мин', dry_hop: 'сухое',
}

// ── Карточка стиля ────────────────────────────────────────────────────────────

function StyleCard({
  style, owned, locked, shopItem, onSelect, onBuy, coins,
}: {
  style:     StyleData
  owned:     boolean
  locked:    boolean       // уровень слишком низкий
  shopItem?: RecipeShopItem
  onSelect:  () => void
  onBuy?:    () => void
  coins:     number
}) {
  const color  = style.srm ? srmToHex((style.srm[0] + style.srm[1]) / 2) : '#4e2a0e'
  const imgSrc = getBeerImage(style.key)

  return (
    <div
      className={`w-full text-left rounded-2xl overflow-hidden border transition-all ${
        locked ? 'border-brown-800 opacity-40'
        : owned ? 'border-brown-700 shadow-sm'
        : shopItem ? 'border-amber-700/40'
        : 'border-brown-800 opacity-60'
      }`}
    >
      <button
        className="w-full flex items-center gap-3 p-3 bg-brown-900 active:opacity-80"
        onClick={onSelect}
        disabled={!owned && !shopItem}
      >
        {/* Картинка или цвет */}
        <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden relative">
          {imgSrc && (owned || shopItem) ? (
            <img src={imgSrc} alt={style.name} className={`w-full h-full object-cover ${!owned ? 'grayscale opacity-60' : ''}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl" style={{ background: locked ? '#2a1a0a' : color }}>
              {locked ? '🔒' : owned ? '🍺' : '📜'}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-cream-100 font-bold text-sm leading-tight">{style.name}</p>
            {locked && <span className="text-amber-600 text-xs shrink-0 ml-1">ур.{style.unlock_level}</span>}
            {owned  && <span className="text-hop-400 text-xs shrink-0">✓ Есть</span>}
          </div>
          <p className="text-cream-200 text-xs opacity-50 mt-0.5">{style.family}</p>
          {owned && (
            <div className="flex gap-3 mt-1.5 text-xs text-cream-200">
              {style.abv && <span>ABV {fmtRange(style.abv, 1)}%</span>}
              {style.ibu && <span>IBU {fmtRange(style.ibu)}</span>}
            </div>
          )}
          {!owned && shopItem && (
            <p className="text-amber-400 text-xs mt-1">💰 {shopItem.price} монет</p>
          )}
        </div>
        {owned && <span className="text-brown-600 text-lg">›</span>}
      </button>

      {/* Кнопка купить */}
      {!owned && shopItem && onBuy && (
        <div className="px-3 pb-3 bg-brown-900">
          <button
            onClick={onBuy}
            disabled={coins < shopItem.price}
            className={`w-full py-2 rounded-xl text-sm font-bold transition-opacity ${
              coins >= shopItem.price
                ? 'bg-amber-600 text-brown-950 active:opacity-80'
                : 'bg-brown-700 text-cream-200 opacity-50'
            }`}
          >
            {coins >= shopItem.price ? `Купить за ${shopItem.price} 🪙` : `Нужно ${shopItem.price} 🪙 (у тебя ${coins})`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Детальный лист стиля ──────────────────────────────────────────────────────

interface MissingItem { key: string; name: string; need: number; have: number; unit: string; icon: string }

function MissingModal({ items, onClose, onGoMarket }: { items: MissingItem[]; onClose: () => void; onGoMarket: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-60" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-brown-950 rounded-t-2xl z-70 p-5 space-y-4">
        <h3 className="text-cream-100 font-bold text-base">Не хватает ингредиентов</h3>
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.key} className="flex items-center justify-between bg-brown-900 border border-red-900/60 rounded-xl px-3 py-2.5">
              <span className="text-cream-100 text-sm">{item.icon} {item.name}</span>
              <span className="text-red-400 text-xs font-semibold">нужно {item.need} {item.unit}, есть {item.have} {item.unit}</span>
            </div>
          ))}
        </div>
        <button className="w-full bg-amber-600 text-brown-950 font-bold py-3 rounded-2xl active:opacity-80" onClick={onGoMarket}>
          🛒 Перейти в магазин
        </button>
        <button className="w-full text-cream-200 text-sm opacity-60 py-1" onClick={onClose}>Закрыть</button>
      </div>
    </>
  )
}

function StyleSheet({ style, owned, stockMap, onClose, onBrew, onGoMarket }: {
  style: StyleData; owned: boolean; stockMap: Record<string, number>
  onClose: () => void; onBrew: (key: string) => void; onGoMarket: () => void
}) {
  const [missingItems, setMissingItems] = useState<MissingItem[] | null>(null)
  const recipe = STYLE_RECIPES[style.key]

  const checkAndBrew = () => {
    if (!recipe) { onClose(); onBrew(style.key); return }
    const missing: MissingItem[] = []
    for (const m of recipe.malts) {
      const have = stockMap[m.key] ?? 0
      if (have < m.amountKg) missing.push({ key: m.key, name: m.name, need: m.amountKg, have, unit: 'кг', icon: '🌾' })
    }
    const hopNeeds: Record<string, { name: string; totalG: number }> = {}
    for (const h of recipe.hops) {
      if (!hopNeeds[h.key]) hopNeeds[h.key] = { name: h.name, totalG: 0 }
      hopNeeds[h.key].totalG += h.amountG
    }
    for (const [key, { name, totalG }] of Object.entries(hopNeeds)) {
      const haveG = (stockMap[key] ?? 0) * 100
      if (haveG < totalG) missing.push({ key, name, need: totalG, have: haveG, unit: 'г', icon: '🌿' })
    }
    if ((stockMap[recipe.yeastKey] ?? 0) < 1) {
      const yeast = YEASTS.find(y => y.key === recipe.yeastKey)
      missing.push({ key: recipe.yeastKey, name: yeast?.name ?? recipe.yeastKey, need: 1, have: stockMap[recipe.yeastKey] ?? 0, unit: 'шт', icon: '🧫' })
    }
    if (missing.length > 0) { setMissingItems(missing); return }
    onClose(); onBrew(style.key)
  }
  const color  = style.srm ? srmToHex((style.srm[0] + style.srm[1]) / 2) : '#4e2a0e'
  const imgSrc = getBeerImage(style.key)

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-brown-950 rounded-t-2xl z-50 max-h-[90vh] overflow-y-auto">
        {imgSrc ? (
          <div className="relative h-40 overflow-hidden rounded-t-2xl">
            <img src={imgSrc} alt={style.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-brown-950 via-brown-950/40 to-transparent" />
            <div className="absolute bottom-3 left-5">
              <p className="text-cream-200 text-xs opacity-70">{style.family}</p>
              <h2 className="text-cream-100 font-bold text-xl">{style.name}</h2>
            </div>
            <button className="absolute top-3 right-3 text-cream-200 text-2xl bg-brown-950/50 rounded-full w-8 h-8 flex items-center justify-center" onClick={onClose}>×</button>
          </div>
        ) : (
          <div className="px-5 pt-5 pb-4 flex items-start gap-4" style={{ background: `linear-gradient(135deg, ${color}22, transparent)` }}>
            <div className="w-14 h-14 rounded-2xl flex-shrink-0" style={{ background: color }} />
            <div className="flex-1">
              <p className="text-cream-200 text-xs opacity-50">{style.family}</p>
              <h2 className="text-cream-100 font-bold text-xl leading-tight">{style.name}</h2>
              <p className="text-amber-400 text-xs mt-0.5">{DIFFICULTY_LABEL[style.difficulty] ?? ''}</p>
            </div>
            <button className="text-cream-200 opacity-40 text-2xl" onClick={onClose}>×</button>
          </div>
        )}

        <div className="px-5 pb-8 space-y-5">
          {imgSrc && <p className="text-amber-400 text-xs">{DIFFICULTY_LABEL[style.difficulty] ?? ''}</p>}

          {/* Параметры */}
          <div>
            <p className="text-cream-200 text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">Целевые параметры</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'OG',  value: style.og  ? fmtRange(style.og, 3)  : '—' },
                { label: 'FG',  value: style.fg  ? fmtRange(style.fg, 3)  : '—' },
                { label: 'ABV', value: style.abv ? fmtRange(style.abv, 1) + '%' : '—' },
                { label: 'IBU', value: style.ibu ? fmtRange(style.ibu)    : '—' },
                { label: 'SRM', value: style.srm ? fmtRange(style.srm)    : '—' },
                { label: 'BUGU',value: style.bugu_target ? fmtRange(style.bugu_target, 1) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-brown-900 border border-brown-800 rounded-xl py-2.5 text-center">
                  <p className="text-amber-400 font-bold text-sm">{value}</p>
                  <p className="text-cream-200 text-xs opacity-50">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Рецепт (только если owned) */}
          {owned && recipe ? (
            <>
              <div>
                <p className="text-cream-200 text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">🌾 Рекомендованный солод</p>
                <div className="space-y-1.5">
                  {recipe.malts.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-brown-900 border border-brown-800 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-cream-100 text-sm font-semibold">{m.name}</p>
                        <p className="text-cream-200 text-xs opacity-50">{m.role}</p>
                      </div>
                      <p className="text-amber-400 font-bold text-sm">{m.amountKg} кг</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-cream-200 text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">🌿 Рекомендованный хмель</p>
                <div className="space-y-1.5">
                  {recipe.hops.map((h, i) => (
                    <div key={i} className="flex items-center justify-between bg-brown-900 border border-brown-800 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-cream-100 text-sm font-semibold">{h.name}</p>
                        <p className="text-cream-200 text-xs opacity-50">{h.role} · {TIMING_LABEL[h.timing] ?? h.timing}</p>
                      </div>
                      <p className="text-amber-400 font-bold text-sm">{h.amountG} г</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-2.5">
                  <p className="text-cream-200 text-xs opacity-50 mb-0.5">🧫 Дрожжи</p>
                  <p className="text-cream-100 text-sm font-semibold">{recipe.yeastName}</p>
                </div>
                <div className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-2.5">
                  <p className="text-cream-200 text-xs opacity-50 mb-0.5">💧 Вода</p>
                  <p className="text-cream-100 text-sm font-semibold">{recipe.waterName}</p>
                </div>
                <div className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-2.5">
                  <p className="text-cream-200 text-xs opacity-50 mb-0.5">🌡️ Затирание</p>
                  <p className="text-cream-100 text-sm font-semibold">{recipe.mashTempC}°C</p>
                </div>
                <div className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-2.5">
                  <p className="text-cream-200 text-xs opacity-50 mb-0.5">🧪 Брожение</p>
                  <p className="text-cream-100 text-sm font-semibold">{recipe.fermentTempC}°C</p>
                </div>
              </div>
              {recipe.notes && (
                <div className="bg-hop-900/40 border border-hop-800/60 rounded-xl px-4 py-3">
                  <p className="text-hop-300 text-sm">{recipe.notes}</p>
                </div>
              )}
            </>
          ) : owned ? (
            <p className="text-cream-200 text-sm opacity-40 text-center py-4">Рецептурные рекомендации появятся позже</p>
          ) : (
            <div className="bg-brown-900 border border-amber-700/30 rounded-xl p-4 text-center">
              <p className="text-amber-400 text-sm font-semibold">🔒 Рецепт не куплен</p>
              <p className="text-cream-200 text-xs opacity-60 mt-1">Купи рецепт чтобы увидеть рекомендации и начать варку</p>
            </div>
          )}

          {/* CTA */}
          {owned && (
            <button
              className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
              onClick={checkAndBrew}
            >🍺 Варить {style.name}</button>
          )}
        </div>
      </div>
      {missingItems && (
        <MissingModal
          items={missingItems}
          onClose={() => setMissingItems(null)}
          onGoMarket={() => { setMissingItems(null); onClose(); onGoMarket() }}
        />
      )}
    </>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────

interface StylesScreenProps {
  onBrew: (styleKey: string) => void
  onGoMarket?: () => void
}

export function StylesScreen({ onBrew, onGoMarket }: StylesScreenProps) {
  const [activeTab,   setActiveTab]   = useState<'mine' | 'shop' | 'all'>('mine')
  const [userLevel,   setUserLevel]   = useState(1)
  const [coins,       setCoins]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [owned,       setOwned]       = useState<Set<string>>(new Set())
  const [shopItems,   setShopItems]   = useState<RecipeShopItem[]>([])
  const [selected,    setSelected]    = useState<StyleData | null>(null)
  const [buying,      setBuying]      = useState<string | null>(null)
  const [stockMap,    setStockMap]    = useState<Record<string, number>>({})

  const load = () => {
    setLoading(true)
    Promise.all([api.getMe(), api.getOwnedRecipes(), api.getRecipeShop(), api.getInventory()])
      .then(([me, ownedRes, shopRes, inv]: [any, any, any, any]) => {
        setUserLevel(me.level ?? 1)
        setCoins(me.softCurrency ?? 0)
        setOwned(new Set((ownedRes.items as OwnedRecipe[]).map(r => r.styleKey)))
        setShopItems(shopRes.items as RecipeShopItem[])
        const stock: Record<string, number> = {}
        for (const item of inv.items) stock[item.key] = item.quantity
        setStockMap(stock)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleBuy = async (styleKey: string) => {
    setBuying(styleKey)
    try {
      await api.buyRecipe(styleKey)
      load()
    } catch (_) {
      // TODO: toast
    } finally {
      setBuying(null)
    }
  }

  // Данные для вкладок
  const myStyles    = BEER_STYLES.filter(s => owned.has(s.key))
  const shopStyles  = BEER_STYLES.filter(s => shopItems.some(si => si.styleKey === s.key))
  const allStyles   = BEER_STYLES

  const shown = activeTab === 'mine' ? myStyles : activeTab === 'shop' ? shopStyles : allStyles

  // Группировка по family
  const families = Array.from(new Set(shown.map(s => s.family ?? 'Другое')))

  return (
    <div className="min-h-screen bg-brown-950 pb-20">
      {/* Шапка */}
      <header className="bg-brown-900 border-b border-brown-800 px-4 pt-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-cream-100 font-bold text-lg">📖 Рецепты</h1>
          <span className="text-amber-400 text-sm font-bold">{coins.toLocaleString('ru')} 🪙</span>
        </div>
        <p className="text-cream-200 text-xs opacity-50">
          {myStyles.length} рецептов · {shopItems.length} доступно к покупке
        </p>

        {/* Вкладки */}
        <div className="flex mt-3 border-b border-brown-800">
          {([
            ['mine',  `Мои (${myStyles.length})`],
            ['shop',  `Магазин${shopItems.length > 0 ? ` (${shopItems.length})` : ''}`],
            ['all',   'Все стили'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-cream-200 opacity-60'
              }`}
            >{label}</button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="px-4 pt-4 space-y-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-5">

          {/* Пустое состояние */}
          {shown.length === 0 && activeTab === 'mine' && (
            <div className="text-center py-12 space-y-3">
              <p className="text-4xl">📜</p>
              <p className="text-cream-100 font-bold">Нет рецептов</p>
              <p className="text-cream-200 text-sm opacity-60">Стартовый рецепт появится автоматически</p>
              <button onClick={() => setActiveTab('shop')} className="bg-amber-600 text-brown-950 font-bold text-sm px-5 py-2.5 rounded-xl">
                Перейти в магазин →
              </button>
            </div>
          )}

          {shown.length === 0 && activeTab === 'shop' && (
            <div className="text-center py-12 space-y-2">
              <p className="text-4xl">🔒</p>
              <p className="text-cream-100 font-bold">Новые рецепты появятся с уровнем</p>
              <p className="text-cream-200 text-sm opacity-60">Сейчас у тебя уровень {userLevel}</p>
            </div>
          )}

          {/* Список стилей */}
          {families.map((family) => {
            const styles = shown.filter(s => (s.family ?? 'Другое') === family)
            return (
              <div key={family}>
                <p className="text-cream-200 text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">{family}</p>
                <div className="space-y-2">
                  {styles.map(s => {
                    const isOwned    = owned.has(s.key)
                    const isLocked   = s.unlock_level > userLevel
                    const shopItem   = shopItems.find(si => si.styleKey === s.key)
                    return (
                      <StyleCard
                        key={s.key}
                        style={s}
                        owned={isOwned}
                        locked={isLocked && !shopItem && !isOwned}
                        shopItem={!isOwned ? shopItem : undefined}
                        coins={coins}
                        onSelect={() => setSelected(s)}
                        onBuy={shopItem && !isOwned ? () => handleBuy(s.key) : undefined}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* В "Все стили" — показываем заблокированные как locked */}
          {activeTab === 'all' && (
            <p className="text-center text-cream-200 text-xs opacity-40 pb-4">
              🔒 — требуется уровень · 📜 — доступно к покупке · ✓ — уже есть
            </p>
          )}
        </div>
      )}

      {/* Детальный лист */}
      {selected && (
        <StyleSheet
          style={selected}
          owned={owned.has(selected.key)}
          stockMap={stockMap}
          onClose={() => setSelected(null)}
          onBrew={onBrew}
          onGoMarket={onGoMarket ?? (() => {})}
        />
      )}

      {/* Оверлей покупки */}
      {buying && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-brown-900 rounded-2xl px-8 py-6 text-center space-y-2">
            <p className="text-2xl animate-pulse">📜</p>
            <p className="text-cream-100 font-bold">Покупаем рецепт...</p>
          </div>
        </div>
      )}
    </div>
  )
}
