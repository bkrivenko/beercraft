import { useState, useEffect } from 'react'
import { api, type PlayerStats, type InventoryItem } from '../lib/api'
import { useTelegram } from '../telegram/useTelegram'
import { BreweryScene } from './BreweryScene'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-brown-800 rounded-xl ${className ?? ''}`} />
}

// ── XP-прогрессбар ────────────────────────────────────────────────────────────
function XpBar({ xp, xpToNext, progress }: { xp: number; xpToNext: number; progress: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-cream-200">
        <span>{xp.toLocaleString('ru')} XP</span>
        <span className="opacity-60">до следующего: {xpToNext.toLocaleString('ru')}</span>
      </div>
      <div className="h-2.5 rounded-full bg-brown-800 overflow-hidden">
        <div
          className="h-2.5 rounded-full bg-amber-600 transition-all duration-700"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  )
}

// ── Карточка статистики ───────────────────────────────────────────────────────
function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="bg-brown-900 border border-brown-800 rounded-xl p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-cream-100 font-bold text-base leading-tight">{value}</div>
      <div className="text-cream-200 text-xs opacity-50 mt-0.5">{label}</div>
    </div>
  )
}

// ── Топ партии ────────────────────────────────────────────────────────────────
function TopBatches({ batches }: { batches: PlayerStats['topBatches'] }) {
  if (!batches.length) return (
    <p className="text-cream-200 text-sm opacity-50 text-center py-4">Нет сваренных партий</p>
  )
  return (
    <div className="space-y-2">
      {batches.map((b, i) => (
        <div key={i} className="flex items-center justify-between bg-brown-900 border border-brown-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-amber-600 font-bold text-sm w-5">#{i + 1}</span>
            <div>
              <p className="text-cream-100 text-sm font-semibold">{b.styleName}</p>
              <p className="text-cream-200 text-xs opacity-60">
                {b.abv != null ? `ABV ${b.abv}%` : ''}{b.ibu != null ? ` · IBU ${b.ibu}` : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-amber-400 font-bold text-base">{b.quality}</p>
            <p className="text-cream-200 text-xs opacity-40">качество</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Следующие разблокировки ───────────────────────────────────────────────────
function NextUnlocks({ unlocks }: { unlocks: NonNullable<PlayerStats['nextLevelUnlocks']> }) {
  const hasContent = unlocks.styles.length + unlocks.ingredients.length + unlocks.equipment.length > 0
  if (!hasContent) return null

  return (
    <div className="bg-brown-900 border border-hop-900 rounded-xl p-4 space-y-3">
      <p className="text-hop-400 text-xs font-semibold uppercase tracking-wider">
        🔓 На уровне {unlocks.level} откроется
      </p>
      {unlocks.styles.length > 0 && (
        <div>
          <p className="text-cream-200 text-xs opacity-60 mb-1">Стили пива</p>
          <div className="flex flex-wrap gap-1">
            {unlocks.styles.map(s => (
              <span key={s} className="bg-brown-800 text-cream-100 text-xs px-2 py-0.5 rounded-full">
                🍺 {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {unlocks.ingredients.length > 0 && (
        <div>
          <p className="text-cream-200 text-xs opacity-60 mb-1">Ингредиенты</p>
          <div className="flex flex-wrap gap-1">
            {unlocks.ingredients.map(i => (
              <span key={i} className="bg-brown-800 text-cream-100 text-xs px-2 py-0.5 rounded-full">
                🌾 {i}
              </span>
            ))}
          </div>
        </div>
      )}
      {unlocks.equipment.length > 0 && (
        <div>
          <p className="text-cream-200 text-xs opacity-60 mb-1">Оборудование</p>
          <div className="space-y-1">
            {unlocks.equipment.map(e => (
              <p key={e} className="text-cream-100 text-xs">⚙️ {e}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Главный экран Э-8 ─────────────────────────────────────────────────────────
export function ProfileScreen({ onBack }: { onBack?: () => void }) {
  const { displayName } = useTelegram()
  const [activeTab,  setActiveTab]  = useState<'profile' | 'brewery'>('profile')
  const [stats,     setStats]     = useState<PlayerStats | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [coins,     setCoins]     = useState(0)

  useEffect(() => {
    Promise.all([api.getStats(), api.getInventory()])
      .then(([s, inv]) => { setStats(s); setInventory(inv.items); setCoins(s.softCurrency) })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e)
        const status = (e as any).status
        if (status === 401 || msg.includes('401') || msg.includes('initData')) {
          setError('Ошибка авторизации Telegram. Попробуйте перезапустить приложение.')
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          setError('Нет соединения с сервером.')
        } else {
          setError(`Ошибка загрузки профиля: ${msg}`)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-brown-950 flex flex-col">
      {/* Шапка */}
      <header className="bg-brown-900 border-b border-brown-800 px-4 pt-3">
        <div className="flex items-center gap-3 mb-3">
          <button className="text-cream-200 text-lg active:opacity-60" onClick={onBack}>‹</button>
          <h1 className="text-cream-100 font-bold text-base">Профиль</h1>
        </div>
        {/* Вкладки */}
        <div className="flex">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-cream-200 opacity-60'
            }`}
          >👤 Профиль</button>
          <button
            onClick={() => setActiveTab('brewery')}
            className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'brewery'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-cream-200 opacity-60'
            }`}
          >🏭 Пивоварня</button>
        </div>
      </header>

      {/* Вкладка Пивоварня */}
      {activeTab === 'brewery' && !loading && stats && (
        <div className="flex-1 overflow-y-auto pb-20">
          <BreweryScene
            userLevel={stats.level}
            coins={coins}
            onCoinsChange={(delta) => setCoins(c => c + delta)}
          />
        </div>
      )}

      <div className={`flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-20 ${activeTab === 'brewery' ? 'hidden' : ''}`}>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20" /><Skeleton className="h-20" />
              <Skeleton className="h-20" /><Skeleton className="h-20" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-12 space-y-4 px-4 text-center">
            <span className="text-4xl">😕</span>
            <p className="text-cream-200 text-sm">{error}</p>
            <button
              className="bg-amber-600 text-brown-950 font-bold text-sm px-5 py-2.5 rounded-xl active:opacity-80"
              onClick={() => { setError(null); setLoading(true); api.getStats().then(setStats).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false)) }}
            >Повторить</button>
            <button
              className="border border-brown-700 text-cream-100 text-sm px-5 py-2.5 rounded-xl active:opacity-70"
              onClick={onBack}
            >← На главную</button>
          </div>
        ) : stats ? (
          <>
            {/* Аватар + имя + уровень */}
            <div className="bg-brown-900 border border-brown-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-amber-600 flex items-center justify-center text-3xl">
                  🍺
                </div>
                <div className="flex-1">
                  <p className="text-cream-100 font-bold text-lg leading-tight">
                    {stats.displayName || displayName}
                  </p>
                  {stats.breweryName && (
                    <p className="text-amber-400 text-xs mt-0.5">{stats.breweryName}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-amber-600 text-brown-950 text-xs font-bold px-2 py-0.5 rounded-full">
                      Уровень {stats.level}
                    </span>
                    <span className="text-cream-200 text-xs opacity-50">
                      Реп. {stats.reputation} ⭐
                    </span>
                  </div>
                </div>
              </div>

              {/* XP-бар */}
              <XpBar
                xp={stats.xp}
                xpToNext={stats.progression.xpToNext}
                progress={stats.progression.xpProgress}
              />

              {/* Кнопка перехода в пивоварню */}
              <button
                onClick={() => setActiveTab('brewery')}
                className="w-full flex items-center justify-between bg-brown-800 border border-amber-700/40 rounded-xl px-4 py-3 active:opacity-80"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏭</span>
                  <div className="text-left">
                    <p className="text-cream-100 text-sm font-bold">Моя пивоварня</p>
                    <p className="text-cream-200 text-xs opacity-60">Оборудование и улучшения</p>
                  </div>
                </div>
                <span className="text-amber-400 text-lg">›</span>
              </button>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon="🍺" label="Сварено"      value={stats.stats.brewsTotal} />
              <StatCard icon="💰" label="Продано"      value={stats.stats.soldBatches} />
              <StatCard icon="⭐" label="Ср. качество" value={stats.stats.avgQuality ?? '—'} />
              <StatCard icon="🪙" label="Заработано"   value={(stats.stats.totalIncome).toLocaleString('ru')} />
            </div>

            {/* Топ варки */}
            <div className="space-y-3">
              <h2 className="text-cream-100 font-bold text-sm flex items-center gap-2">
                <span className="text-amber-600">🏆</span> Лучшие партии
              </h2>
              <TopBatches batches={stats.topBatches} />
            </div>

            {/* Следующие разблокировки */}
            {stats.nextLevelUnlocks && (
              <NextUnlocks unlocks={stats.nextLevelUnlocks} />
            )}

            {/* Ингредиенты на складе */}
            {inventory.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-cream-100 font-bold text-sm flex items-center gap-2">
                  <span className="text-amber-600">📦</span> Склад ингредиентов
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {inventory.filter(item => item.type !== 'water').map(item => {
                    const icon = item.type === 'malt' ? '🌾'
                      : item.type === 'hop' ? '🌿'
                      : item.type === 'yeast' ? '🧫'
                      : item.type === 'water' ? '💧'
                      : '🍊'
                    return (
                      <div key={item.key} className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
                        <span className="text-xl">{icon}</span>
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
            {inventory.length === 0 && (
              <div className="bg-brown-900 border border-brown-800 rounded-xl px-4 py-4 text-center">
                <p className="text-cream-200 text-sm opacity-60">📦 Склад пуст</p>
                <p className="text-cream-200 text-xs opacity-40 mt-1">Купи ингредиенты в Рынке → Магазин</p>
              </div>
            )}

            {/* Валюта + репутация */}
            <div className="bg-brown-900 border border-brown-800 rounded-xl p-4 space-y-2">
              <h2 className="text-cream-100 font-bold text-sm">💼 Кошелёк</h2>
              <div className="flex justify-between text-sm">
                <span className="text-cream-200">Монеты</span>
                <span className="text-cream-100 font-bold">{stats.softCurrency.toLocaleString('ru')} 🪙</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-cream-200">Репутация</span>
                <span className="text-cream-100 font-bold">{stats.reputation} ⭐</span>
              </div>
            </div>

            {/* Настройки */}
            <div className="bg-brown-900 border border-brown-800 rounded-xl divide-y divide-brown-800">
              <h2 className="text-cream-100 font-bold text-sm px-4 pt-4 pb-3">⚙️ Настройки</h2>
              {[
                { label: 'Язык',  value: 'Русский' },
                { label: 'Тема',  value: 'Авто (из Telegram)' },
                { label: '18+',   value: 'Подтверждено ✓' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center px-4 py-3">
                  <span className="text-cream-200 text-sm">{label}</span>
                  <span className="text-cream-100 text-sm opacity-70">{value}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-cream-200 text-xs opacity-30">
              В игре с {new Date(stats.createdAt).toLocaleDateString('ru')}
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
