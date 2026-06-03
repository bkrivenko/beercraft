import { useState, useMemo, useCallback, useEffect } from 'react'
import { api } from '../../lib/api'
import { ParamPanel } from '../../components/ParamPanel'
import {
  calculatePreview,
  type MaltEntry,
  type HopEntry,
  type HopTiming,
} from '../../lib/brewCalc'
import {
  MALTS,
  HOPS,
  YEASTS,
  WATER_PROFILES,
  BEER_STYLES,
  type StyleData,
} from '../../lib/contentData'

// ── Типы ─────────────────────────────────────────────────────────────────────

type Tab = 'malt' | 'hops' | 'yeast' | 'water' | 'adjuncts'

const TAB_LABELS: Record<Tab, string> = {
  malt:     'Засыпь',
  hops:     'Хмель',
  yeast:    'Дрожжи',
  water:    'Вода',
  adjuncts: 'Добавки',
}

// ── Вспомогательные компоненты ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-cream-200 text-xs font-semibold uppercase tracking-wider opacity-60">{title}</h3>
      {children}
    </div>
  )
}

function AmountControl({
  value,
  step,
  unit,
  onChange,
}: {
  value: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        className="w-7 h-7 rounded-full bg-brown-800 text-cream-100 font-bold text-base flex items-center justify-center active:opacity-70"
        onClick={() => onChange(Math.max(0, Math.round((value - step) * 100) / 100))}
      >−</button>
      <span className="text-cream-100 text-sm w-16 text-center">
        {value > 0 ? `${value} ${unit}` : '—'}
      </span>
      <button
        className="w-7 h-7 rounded-full bg-amber-600 text-brown-950 font-bold text-base flex items-center justify-center active:opacity-70"
        onClick={() => onChange(Math.round((value + step) * 100) / 100)}
      >+</button>
    </div>
  )
}

// ── Таб: Засыпь ───────────────────────────────────────────────────────────────

function MaltTab({
  malts,
  onChange,
  stockMap,
}: {
  malts:    MaltEntry[]
  onChange: (malts: MaltEntry[]) => void
  stockMap: Record<string, number>
}) {
  const setAmount = (key: string, amountKg: number) => {
    if (amountKg <= 0) {
      onChange(malts.filter((m) => m.key !== key))
    } else {
      const exists = malts.find((m) => m.key === key)
      if (exists) {
        onChange(malts.map((m) => m.key === key ? { ...m, amountKg } : m))
      } else {
        const ing = MALTS.find((i) => i.key === key)!
        onChange([...malts, {
          key,
          name: ing.name,
          ppkg: ing.params.ppkg as number,
          colorL: ing.params.color_l as number,
          amountKg,
        }])
      }
    }
  }

  return (
    <Section title="Солод">
      <div className="space-y-2">
        {MALTS.map((ing) => {
          const entry   = malts.find((m) => m.key === ing.key)
          const inStock = stockMap[ing.key] ?? 0
          const hasStock = inStock > 0
          return (
            <div
              key={ing.key}
              className={`flex items-center justify-between border rounded-xl px-3 py-2 ${
                hasStock
                  ? 'bg-brown-900 border-brown-800'
                  : 'bg-brown-900/40 border-brown-800/40 opacity-50'
              }`}
            >
              <div className="flex-1 min-w-0 mr-2">
                <div className="text-cream-100 text-sm font-semibold">{ing.name}</div>
                <div className="text-amber-400 text-xs opacity-70">
                  {(ing.params.ppkg as number)} ppkg · {(ing.params.color_l as number)}°L
                </div>
                {hasStock
                  ? <div className="text-hop-400 text-xs">На складе: {inStock} кг</div>
                  : <div className="text-red-400 text-xs">Нет на складе → купи в Рынке</div>
                }
              </div>
              {hasStock ? (
                <AmountControl
                  value={entry?.amountKg ?? 0}
                  step={0.1}
                  unit="кг"
                  onChange={(v) => setAmount(ing.key, v)}
                />
              ) : (
                <span className="text-brown-600 text-xs">🔒</span>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ── Таб: Хмель ────────────────────────────────────────────────────────────────

const HOP_TIMING_LABELS: Record<HopTiming, string> = {
  bittering: '⚡ 60 мин',
  flavor:    '🌿 15 мин',
  aroma:     '🌸 5 мин',
  dry_hop:   '🧊 Сухое',
}

function HopsTab({
  hops,
  onChange,
  stockMap,
}: {
  hops:     HopEntry[]
  onChange: (hops: HopEntry[]) => void
  stockMap: Record<string, number>
}) {
  const updateHop = (idx: number, patch: Partial<HopEntry>) => {
    onChange(hops.map((h, i) => i === idx ? { ...h, ...patch } : h))
  }
  const removeHop = (idx: number) => onChange(hops.filter((_, i) => i !== idx))
  // Только хмель который есть на складе
  const availableHops = HOPS.filter((h) => (stockMap[h.key] ?? 0) > 0)
  const addHop = () => {
    const first = availableHops[0] ?? HOPS[0]
    onChange([...hops, {
      key: first.key,
      name: first.name,
      alphaFraction: first.params.alpha as number,
      amountG: 20,
      timing: 'bittering',
    }])
  }

  return (
    <Section title="Хмелевая программа">
      <div className="space-y-3">
        {hops.map((hop, idx) => (
          <div key={idx} className="bg-brown-900 border border-brown-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              {/* Выбор сорта */}
              <select
                className="bg-brown-800 text-cream-100 text-sm rounded-lg px-2 py-1 border border-brown-700 flex-1 mr-2"
                value={hop.key}
                onChange={(e) => {
                  const ing = HOPS.find((h) => h.key === e.target.value)!
                  updateHop(idx, {
                    key: ing.key,
                    name: ing.name,
                    alphaFraction: ing.params.alpha as number,
                  })
                }}
              >
                {HOPS.map((h) => {
                  const inStock = stockMap[h.key] ?? 0
                  return (
                    <option key={h.key} value={h.key} disabled={inStock === 0}>
                      {h.name} ({Math.round((h.params.alpha as number) * 100)}% α){inStock === 0 ? ' — нет на складе' : ` — ${inStock}×100г`}
                    </option>
                  )
                })}
              </select>
              <button
                className="text-red-400 text-xs px-1 active:opacity-60"
                onClick={() => removeHop(idx)}
              >✕</button>
            </div>

            {/* Тайм-слоты */}
            <div className="flex gap-1 flex-wrap">
              {(Object.keys(HOP_TIMING_LABELS) as HopTiming[]).map((t) => (
                <button
                  key={t}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    hop.timing === t
                      ? 'bg-amber-600 border-amber-600 text-brown-950 font-bold'
                      : 'border-brown-700 text-cream-200 active:opacity-70'
                  }`}
                  onClick={() => updateHop(idx, { timing: t })}
                >
                  {HOP_TIMING_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Масса */}
            <div className="flex items-center justify-between">
              <span className="text-cream-200 text-xs">Масса</span>
              <AmountControl
                value={hop.amountG}
                step={5}
                unit="г"
                onChange={(v) => updateHop(idx, { amountG: v })}
              />
            </div>
          </div>
        ))}
        {availableHops.length === 0 ? (
          <div className="text-center py-3 text-red-400 text-xs">
            Нет хмеля на складе — купи в Рынке → Магазин
          </div>
        ) : (
          <button
            className="w-full border border-dashed border-brown-700 text-cream-200 text-sm rounded-xl py-2 active:opacity-70"
            onClick={addHop}
          >
            + Добавить хмель
          </button>
        )}
      </div>
    </Section>
  )
}

// ── Таб: Дрожжи ───────────────────────────────────────────────────────────────

function YeastTab({
  yeastKey,
  mashTempC,
  fermentTempC,
  onYeastChange,
  onMashTempChange,
  onFermentTempChange,
}: {
  yeastKey: string
  mashTempC: number
  fermentTempC: number
  onYeastChange: (key: string, attenuation: number) => void
  onMashTempChange: (t: number) => void
  onFermentTempChange: (t: number) => void
}) {
  return (
    <Section title="Дрожжи и процесс">
      <div className="space-y-3">
        {/* Выбор дрожжей */}
        <div className="space-y-2">
          {YEASTS.map((y) => {
            const att = y.params.attenuation as number
            const tmin = y.params.temp_min as number
            const tmax = y.params.temp_max as number
            return (
              <button
                key={y.key}
                className={`w-full text-left bg-brown-900 border rounded-xl px-3 py-2 transition-colors ${
                  yeastKey === y.key
                    ? 'border-amber-600'
                    : 'border-brown-800 active:opacity-70'
                }`}
                onClick={() => onYeastChange(y.key, att)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-cream-100 text-sm font-semibold">{y.name}</span>
                  {yeastKey === y.key && <span className="text-amber-600 text-xs">✓</span>}
                </div>
                <div className="text-amber-400 text-xs opacity-70">
                  Атт. {Math.round(att * 100)}% · {tmin}–{tmax}°C
                </div>
                <div className="text-cream-200 text-xs opacity-50">{y.params.profile as string}</div>
              </button>
            )
          })}
        </div>

        {/* Температура затирания */}
        <div className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-2">
          <div className="flex justify-between text-sm text-cream-100 mb-2">
            <span>Затирание</span>
            <span className="text-amber-400 font-bold">{mashTempC}°C</span>
          </div>
          <input
            type="range" min={63} max={70} step={1}
            value={mashTempC}
            onChange={(e) => onMashTempChange(Number(e.target.value))}
            className="w-full accent-amber-600"
          />
          <div className="flex justify-between text-xs text-cream-200 opacity-40 mt-1">
            <span>63°C (суше)</span><span>70°C (полнее)</span>
          </div>
        </div>

        {/* Температура брожения */}
        <div className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-2">
          <div className="flex justify-between text-sm text-cream-100 mb-2">
            <span>Брожение</span>
            <span className="text-amber-400 font-bold">{fermentTempC}°C</span>
          </div>
          <input
            type="range" min={8} max={28} step={1}
            value={fermentTempC}
            onChange={(e) => onFermentTempChange(Number(e.target.value))}
            className="w-full accent-amber-600"
          />
          <div className="flex justify-between text-xs text-cream-200 opacity-40 mt-1">
            <span>8°C (лагер)</span><span>28°C (бельгийский)</span>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ── Таб: Вода ────────────────────────────────────────────────────────────────

function WaterTab({
  waterKey,
  onChange,
  targetStyleKey,
}: {
  waterKey: string
  onChange: (key: string) => void
  targetStyleKey?: string
}) {
  return (
    <Section title="Профиль воды">
      <div className="space-y-2">
        {WATER_PROFILES.map((w) => {
          const isRecommended = targetStyleKey && w.best_for.some(
            (s) => targetStyleKey.includes(s) || s.includes(targetStyleKey.replace('_', ''))
          )
          return (
            <button
              key={w.key}
              className={`w-full text-left bg-brown-900 border rounded-xl px-3 py-2 transition-colors ${
                waterKey === w.key ? 'border-amber-600' : 'border-brown-800 active:opacity-70'
              }`}
              onClick={() => onChange(w.key)}
            >
              <div className="flex items-center justify-between">
                <span className="text-cream-100 text-sm font-semibold">{w.name}</span>
                <div className="flex gap-1">
                  {isRecommended && (
                    <span className="text-xs bg-hop-900 text-hop-400 px-1.5 py-0.5 rounded-full">рекомендуется</span>
                  )}
                  {waterKey === w.key && <span className="text-amber-600 text-xs">✓</span>}
                </div>
              </div>
              <div className="text-cream-200 text-xs opacity-50 mt-0.5">
                {w.best_for.join(', ')}
              </div>
            </button>
          )
        })}
      </div>
    </Section>
  )
}

// ── Таб: Добавки ──────────────────────────────────────────────────────────────

function AdjunctsTab() {
  return (
    <Section title="Добавки">
      <div className="flex flex-col items-center justify-center py-8 space-y-2">
        <span className="text-3xl">🍋</span>
        <p className="text-cream-200 text-sm opacity-60">Добавки будут доступны на уровне 4</p>
      </div>
    </Section>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────

interface RecipeConstructorProps {
  onBrew?: (recipe: {
    malts: MaltEntry[]
    hops: HopEntry[]
    yeastKey: string
    waterKey: string
    mashTempC: number
    fermentTempC: number
    volumeL: number
    targetStyleKey?: string
  }) => void
  onBack?: () => void
  brewing?: boolean
  initialStyleKey?: string
}

export function RecipeConstructor({ onBrew, onBack, brewing = false, initialStyleKey }: RecipeConstructorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('malt')
  const [targetStyleKey, setTargetStyleKey] = useState<string>(initialStyleKey ?? '')

  // ── Загружаем инвентарь и уровень игрока ─────────────────────────────────
  const [stockMap,    setStockMap]    = useState<Record<string, number>>({})
  const [userLevel,   setUserLevel]   = useState<number>(1)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getInventory(), api.getMe()])
      .then(([inv, me]) => {
        const stock: Record<string, number> = {}
        for (const item of inv.items) stock[item.key] = item.quantity
        setStockMap(stock)
        setUserLevel(me.level ?? 1)
      })
      .catch(() => { /* показываем всё если ошибка */ })
      .finally(() => setDataLoading(false))
  }, [])

  // Рецепт
  const [malts,        setMalts]        = useState<MaltEntry[]>([])
  const [hops,         setHops]         = useState<HopEntry[]>([])
  const [yeastKey,     setYeastKey]     = useState('us05')
  const [yeastAtt,     setYeastAtt]     = useState(0.77)
  const [waterKey,     setWaterKey]     = useState('hoppy')
  const [mashTempC,    setMashTempC]    = useState(66)
  const [fermentTempC, setFermentTempC] = useState(19)
  const volumeL = 20 // базовый объём (в будущем — слайдер)

  // Только разблокированные стили
  const availableStyles = useMemo(
    () => BEER_STYLES.filter((s) => s.unlock_level <= userLevel),
    [userLevel],
  )

  const targetStyle: StyleData | undefined = BEER_STYLES.find((s) => s.key === targetStyleKey)

  // Живой пересчёт — только клиент, без запросов к серверу
  const preview = useMemo(
    () => calculatePreview({ malts, hops, yeastAttenuation: yeastAtt, mashTempC, volumeL }),
    [malts, hops, yeastAtt, mashTempC, volumeL],
  )

  // Простой styleMatch по диапазонам (приближение для клиентского превью)
  const styleMatchPct = useMemo(() => {
    if (!targetStyle) return undefined
    if (malts.length === 0) return 0
    const checks = [
      targetStyle.abv ? (preview.abv >= targetStyle.abv[0] && preview.abv <= targetStyle.abv[1] ? 100 : 40) : null,
      targetStyle.ibu ? (preview.ibu >= targetStyle.ibu[0] && preview.ibu <= targetStyle.ibu[1] ? 100 : 40) : null,
      targetStyle.srm ? (preview.srm >= targetStyle.srm[0] && preview.srm <= targetStyle.srm[1] ? 100 : 60) : null,
      targetStyle.og  ? (preview.og  >= targetStyle.og[0]  && preview.og  <= targetStyle.og[1]  ? 100 : 50) : null,
    ].filter((v): v is number => v !== null)
    return checks.length > 0 ? Math.round(checks.reduce((a, b) => a + b, 0) / checks.length) : 0
  }, [preview, targetStyle])

  const handleYeastChange = useCallback((key: string, att: number) => {
    setYeastKey(key)
    setYeastAtt(att)
  }, [])

  const styleRange = targetStyle
    ? { og: targetStyle.og, fg: targetStyle.fg, abv: targetStyle.abv, ibu: targetStyle.ibu, srm: targetStyle.srm }
    : undefined

  const canBrew = malts.length > 0 && hops.length > 0

  return (
    <div className="min-h-screen bg-brown-950 flex flex-col">
      {/* Шапка */}
      <header className="bg-brown-900 border-b border-brown-800 px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <button className="text-cream-200 text-lg active:opacity-60" onClick={onBack}>‹</button>
          <h1 className="text-cream-100 font-bold text-base flex-1">Конструктор рецепта</h1>
        </div>

        {/* Выбор целевого стиля */}
        <select
          className="w-full bg-brown-800 text-cream-100 text-sm rounded-xl px-3 py-2 border border-brown-700"
          value={targetStyleKey}
          onChange={(e) => setTargetStyleKey(e.target.value)}
          disabled={dataLoading}
        >
          <option value="">— Свободный стиль —</option>
          {availableStyles.map((s) => (
            <option key={s.key} value={s.key}>{s.name}</option>
          ))}
          {dataLoading && <option disabled>Загрузка…</option>}
        </select>
        {availableStyles.length === 0 && !dataLoading && (
          <p className="text-amber-400 text-xs mt-1">🔒 Повышай уровень чтобы открывать новые стили</p>
        )}
      </header>

      {/* ParamPanel — живой предпросмотр */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-cream-200 text-xs opacity-40 mb-2">Предпросмотр · пересчитывается при изменении</p>
        <ParamPanel
          preview={preview}
          styleRange={styleRange}
          showStyleMatch={!!targetStyleKey}
          styleMatchPct={styleMatchPct}
        />
      </div>

      {/* Табы */}
      <div className="px-4 pt-3">
        <div className="flex gap-1 bg-brown-900 border border-brown-800 rounded-xl p-1">
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-amber-600 text-brown-950'
                  : 'text-cream-200 active:opacity-70'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Контент таба */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {activeTab === 'malt'     && <MaltTab  malts={malts} onChange={setMalts} stockMap={stockMap} />}
        {activeTab === 'hops'     && <HopsTab  hops={hops}   onChange={setHops}  stockMap={stockMap} />}
        {activeTab === 'yeast'    && (
          <YeastTab
            yeastKey={yeastKey}
            mashTempC={mashTempC}
            fermentTempC={fermentTempC}
            onYeastChange={handleYeastChange}
            onMashTempChange={setMashTempC}
            onFermentTempChange={setFermentTempC}
          />
        )}
        {activeTab === 'water'    && (
          <WaterTab waterKey={waterKey} onChange={setWaterKey} targetStyleKey={targetStyleKey} />
        )}
        {activeTab === 'adjuncts' && <AdjunctsTab />}
      </div>

      {/* Нижняя кнопка */}
      <div className="px-4 py-4 border-t border-brown-800 bg-brown-950">
        {!canBrew && (
          <p className="text-cream-200 text-xs opacity-50 text-center mb-2">
            Добавь солод и хмель чтобы начать варку
          </p>
        )}
        <button
          disabled={!canBrew || brewing}
          className={`w-full font-bold py-3.5 rounded-2xl text-base transition-colors ${
            canBrew && !brewing
              ? 'bg-amber-600 text-brown-950 active:opacity-80'
              : 'bg-brown-800 text-cream-200 opacity-50 cursor-not-allowed'
          }`}
          onClick={() => canBrew && !brewing && onBrew?.({
            malts, hops, yeastKey, waterKey, mashTempC, fermentTempC, volumeL, targetStyleKey: targetStyleKey || undefined,
          })}
        >
          {brewing ? '⏳ Запуск…' : '🍺 Варить'}
        </button>
      </div>
    </div>
  )
}
