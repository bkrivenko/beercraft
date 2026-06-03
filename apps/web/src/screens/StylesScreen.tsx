/**
 * Экран «Рецепты» — каталог стилей пива
 * Показывает доступные (по уровню) и заблокированные стили,
 * для каждого — характеристики + рекомендованные ингредиенты
 */

import { useState, useEffect } from 'react'
import { srmToHex } from '../lib/brewCalc'
import { getBeerImage } from '../components/BeerCard'
import { api } from '../lib/api'
import {
  BEER_STYLES,
  STYLE_RECIPES,
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
  bittering: '60 мин',
  flavor:    '15 мин',
  aroma:     '5 мин',
  dry_hop:   'сухое',
}

// ── Карточка стиля в списке ───────────────────────────────────────────────────

function StyleCard({
  style,
  locked,
  onSelect,
}: {
  style:    StyleData
  locked:   boolean
  onSelect: () => void
}) {
  const color  = style.srm ? srmToHex((style.srm[0] + style.srm[1]) / 2) : '#4e2a0e'
  const imgSrc = getBeerImage(style.key)

  return (
    <button
      className={`w-full text-left rounded-2xl overflow-hidden border transition-all active:opacity-80 ${
        locked
          ? 'border-brown-800 opacity-50'
          : 'border-brown-700 shadow-sm'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 p-3 bg-brown-900">
        {/* Картинка или цвет пива */}
        <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden relative">
          {imgSrc && !locked ? (
            <img src={imgSrc} alt={style.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-xl"
              style={{ background: locked ? '#2a1a0a' : color }}
            >
              {locked ? '🔒' : '🍺'}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-cream-100 font-bold text-sm leading-tight">{style.name}</p>
            {locked && (
              <span className="text-amber-600 text-xs shrink-0 ml-1">ур. {style.unlock_level}</span>
            )}
          </div>
          <p className="text-cream-200 text-xs opacity-50 mt-0.5">{style.family}</p>

          {/* Быстрые характеристики */}
          {!locked && (
            <div className="flex gap-3 mt-1.5 text-xs text-cream-200">
              {style.abv && <span>ABV {fmtRange(style.abv, 1)}%</span>}
              {style.ibu && <span>IBU {fmtRange(style.ibu)}</span>}
              {style.srm && <span>SRM {fmtRange(style.srm)}</span>}
            </div>
          )}
        </div>

        {!locked && (
          <span className="text-brown-600 text-lg">›</span>
        )}
      </div>
    </button>
  )
}

// ── Детальный лист стиля ──────────────────────────────────────────────────────

function StyleSheet({
  style,
  onClose,
  onBrew,
}: {
  style:   StyleData
  onClose: () => void
  onBrew:  (styleKey: string) => void
}) {
  const recipe = STYLE_RECIPES[style.key]
  const color  = style.srm ? srmToHex((style.srm[0] + style.srm[1]) / 2) : '#4e2a0e'
  const imgSrc = getBeerImage(style.key)

  return (
    <>
      {/* Затемнение */}
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />

      {/* Лист */}
      <div className="fixed bottom-0 left-0 right-0 bg-brown-950 rounded-t-2xl z-50 max-h-[90vh] overflow-y-auto">
        {/* Картинка-шапка на всю ширину */}
        {imgSrc && (
          <div className="relative h-40 overflow-hidden rounded-t-2xl">
            <img src={imgSrc} alt={style.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-brown-950 via-brown-950/40 to-transparent" />
            <div className="absolute bottom-3 left-5">
              <p className="text-cream-200 text-xs opacity-70">{style.family}</p>
              <h2 className="text-cream-100 font-bold text-xl">{style.name}</h2>
            </div>
            <button className="absolute top-3 right-3 text-cream-200 opacity-60 text-2xl leading-none bg-brown-950/50 rounded-full w-8 h-8 flex items-center justify-center" onClick={onClose}>×</button>
          </div>
        )}

        {/* Шапка без картинки */}
        {!imgSrc && (
        <div
          className="px-5 pt-5 pb-4 flex items-start gap-4"
          style={{ background: `linear-gradient(135deg, ${color}22, transparent)` }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex-shrink-0"
            style={{ background: color }}
          />
          <div className="flex-1">
            <div className="w-8 h-1 bg-brown-700 rounded-full mx-auto mb-3" />
            <p className="text-cream-200 text-xs opacity-50">{style.family}</p>
            <h2 className="text-cream-100 font-bold text-xl leading-tight">{style.name}</h2>
            <p className="text-amber-400 text-xs mt-0.5">{DIFFICULTY_LABEL[style.difficulty] ?? ''}</p>
          </div>
          <button className="text-cream-200 opacity-40 text-2xl leading-none" onClick={onClose}>×</button>
        </div>
        )}

        <div className="px-5 pb-8 space-y-5">
          {/* Сложность под картинкой */}
          {imgSrc && (
            <p className="text-amber-400 text-xs">{DIFFICULTY_LABEL[style.difficulty] ?? ''}</p>
          )}
          {/* Целевые параметры */}
          <div>
            <p className="text-cream-200 text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">
              Целевые параметры
            </p>
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

          {/* Рекомендованный рецепт */}
          {recipe ? (
            <>
              {/* Солод */}
              <div>
                <p className="text-cream-200 text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">
                  🌾 Рекомендованный солод
                </p>
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

              {/* Хмель */}
              <div>
                <p className="text-cream-200 text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">
                  🌿 Рекомендованный хмель
                </p>
                <div className="space-y-1.5">
                  {recipe.hops.map((h, i) => (
                    <div key={i} className="flex items-center justify-between bg-brown-900 border border-brown-800 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-cream-100 text-sm font-semibold">{h.name}</p>
                        <p className="text-cream-200 text-xs opacity-50">
                          {h.role} · {TIMING_LABEL[h.timing] ?? h.timing}
                        </p>
                      </div>
                      <p className="text-amber-400 font-bold text-sm">{h.amountG} г</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Дрожжи + Вода + Температуры */}
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

              {/* Заметки */}
              {recipe.notes && (
                <div className="bg-hop-900/40 border border-hop-800/60 rounded-xl px-4 py-3">
                  <p className="text-hop-300 text-sm">{recipe.notes}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-cream-200 text-sm opacity-40 text-center py-4">
              Рецептурные рекомендации появятся позже
            </p>
          )}

          {/* CTA */}
          <button
            className="w-full bg-amber-600 text-brown-950 font-bold py-3.5 rounded-2xl text-base shadow-lg active:opacity-80"
            onClick={() => { onClose(); onBrew(style.key) }}
          >
            🍺 Варить {style.name}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────

interface StylesScreenProps {
  onBrew: (styleKey: string) => void
}

export function StylesScreen({ onBrew }: StylesScreenProps) {
  const [userLevel,   setUserLevel]   = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState<StyleData | null>(null)
  const [filterTab,   setFilterTab]   = useState<'available' | 'all'>('available')

  useEffect(() => {
    api.getMe()
      .then((me) => setUserLevel(me.level ?? 1))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const available = BEER_STYLES.filter((s) => s.unlock_level <= userLevel)
  const locked    = BEER_STYLES.filter((s) => s.unlock_level > userLevel)
  const shown     = filterTab === 'available' ? available : BEER_STYLES

  // Группируем по family
  const families = Array.from(new Set(shown.map((s) => s.family ?? 'Другое')))

  return (
    <div className="min-h-screen bg-brown-950 pb-20">
      {/* Шапка */}
      <header className="bg-brown-900 border-b border-brown-800 px-4 py-4">
        <h1 className="text-cream-100 font-bold text-lg">📖 Рецепты</h1>
        <p className="text-cream-200 text-xs opacity-50 mt-0.5">
          Доступно {available.length} из {BEER_STYLES.length} стилей
        </p>

        {/* Фильтр */}
        <div className="flex gap-1 mt-3 bg-brown-800 rounded-xl p-1">
          {([['available', `Доступные (${available.length})`], ['all', `Все (${BEER_STYLES.length})`]] as const).map(([key, label]) => (
            <button
              key={key}
              className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition-colors ${
                filterTab === key ? 'bg-amber-600 text-brown-950' : 'text-cream-200 active:opacity-70'
              }`}
              onClick={() => setFilterTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="px-4 pt-4 space-y-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-5">
          {families.map((family) => {
            const styles = shown.filter((s) => (s.family ?? 'Другое') === family)
            return (
              <div key={family}>
                <p className="text-cream-200 text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">
                  {family}
                </p>
                <div className="space-y-2">
                  {styles.map((s) => (
                    <StyleCard
                      key={s.key}
                      style={s}
                      locked={s.unlock_level > userLevel}
                      onSelect={() => s.unlock_level <= userLevel && setSelected(s)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {filterTab === 'available' && locked.length > 0 && (
            <div
              className="bg-brown-900/50 border border-brown-800 border-dashed rounded-2xl px-4 py-4 text-center cursor-pointer active:opacity-80"
              onClick={() => setFilterTab('all')}
            >
              <p className="text-cream-200 text-sm opacity-50">
                🔒 Ещё {locked.length} стилей откроются с опытом
              </p>
              <p className="text-amber-600 text-xs mt-1">Показать все →</p>
            </div>
          )}
        </div>
      )}

      {/* Детальный лист */}
      {selected && (
        <StyleSheet
          style={selected}
          onClose={() => setSelected(null)}
          onBrew={onBrew}
        />
      )}
    </div>
  )
}
