import { useCountdown, formatCountdown } from '../lib/useApi'
import { srmToHex } from '../lib/brewCalc'

export interface BeerCardProps {
  id: string
  name: string
  styleName: string | null
  styleKey?: string | null
  ibu: number | null
  abv: number | null
  quality: number | null
  srm: number | null
  status: 'mashing' | 'boiling' | 'fermenting' | 'conditioning' | 'ready' | 'sold'
  readyAt: string | null
  startedAt?: string | null
  onClick?: () => void
}

// Картинка для стиля пива (из /assets/beer/)
export function getBeerImage(styleKey?: string | null): string | null {
  if (!styleKey) return null
  return `/assets/beer/beer_${styleKey}.webp`
}

// ── Порядок и длительность этапов ────────────────────────────────────────────
const STAGE_ORDER = ['mashing', 'boiling', 'fermenting', 'conditioning', 'ready'] as const
type ActiveStatus = 'mashing' | 'boiling' | 'fermenting' | 'conditioning'

// Длительности этапов в секундах (зеркало сервера)
const STAGE_DURATION_S: Record<ActiveStatus, number> = {
  mashing:      5 * 60,
  boiling:      5 * 60,
  fermenting:   4 * 60 * 60,
  conditioning: 2 * 60 * 60,
}

const STATUS_ICON: Record<BeerCardProps['status'], string> = {
  mashing:      '🌾',
  boiling:      '🔥',
  fermenting:   '🧪',
  conditioning: '❄️',
  ready:        '✅',
  sold:         '💰',
}

const STATUS_LABEL: Record<BeerCardProps['status'], string> = {
  mashing:      'Затирание',
  boiling:      'Варка',
  fermenting:   'Брожение',
  conditioning: 'Выдержка',
  ready:        'Готово!',
  sold:         'Продано',
}

const NEXT_LABEL: Record<ActiveStatus, string> = {
  mashing:      'затем варка 5 мин',
  boiling:      'затем брожение 4 ч',
  fermenting:   'затем выдержка 2 ч',
  conditioning: 'затем готово к продаже →',
}

// ── Прогресс-бар этапа ────────────────────────────────────────────────────────
function StageProgress({
  secondsLeft,
  status,
}: {
  secondsLeft: number
  status: ActiveStatus
}) {
  const total   = STAGE_DURATION_S[status]
  const elapsed = Math.max(0, total - secondsLeft)
  const pct     = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0

  const barColor =
    status === 'mashing'      ? 'bg-amber-500'
    : status === 'boiling'    ? 'bg-amber-600'
    : status === 'fermenting' ? 'bg-hop-600'
    : 'bg-hop-400'

  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-brown-700 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-cream-200 text-xs opacity-40 text-right">{Math.round(pct)}%</p>
    </div>
  )
}

// ── Цепочка этапов ────────────────────────────────────────────────────────────
function StagePipeline({ status }: { status: BeerCardProps['status'] }) {
  const currentIdx = STAGE_ORDER.indexOf(status as typeof STAGE_ORDER[number])

  return (
    <div className="flex items-center gap-0.5">
      {STAGE_ORDER.map((s, i) => {
        const done    = i < currentIdx
        const current = i === currentIdx

        return (
          <div key={s} className="flex items-center gap-0.5">
            <div className={`text-xs ${
              current ? 'opacity-100' : done ? 'opacity-60' : 'opacity-20'
            }`}>
              {STATUS_ICON[s]}
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <div className={`w-3 h-0.5 rounded-full ${
                done ? 'bg-hop-600' : current ? 'bg-amber-500' : 'bg-brown-700'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────

export function BeerCard({
  name, styleName, styleKey, ibu, abv, quality, srm,
  status, readyAt, onClick,
}: BeerCardProps) {
  const seconds   = useCountdown(readyAt)
  const isActive  = ['mashing', 'boiling', 'fermenting', 'conditioning'].includes(status)
  const isReady   = status === 'ready'
  const beerColor = srm != null ? srmToHex(srm) : '#3b1e0a'
  const imgSrc    = getBeerImage(styleKey)

  return (
    <article
      className={`bg-brown-900 rounded-2xl overflow-hidden border shadow-lg flex flex-col ${
        isReady
          ? 'border-amber-500 shadow-amber-900/30'
          : 'border-brown-800'
      } ${onClick ? 'cursor-pointer active:opacity-80' : ''}`}
      onClick={onClick}
    >
      {/* Картинка или цветной блок */}
      <div className="relative h-28 overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={styleName ?? name}
            className={`w-full h-full object-cover transition-all ${
              isActive ? 'opacity-60 grayscale-[30%]' : isReady ? 'opacity-100' : 'opacity-80'
            }`}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: isReady ? beerColor : `${beerColor}88` }}
          />
        )}

        {/* Затемнение снизу для читаемости текста */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-brown-900/80 to-transparent" />

        {/* Анимация для активных */}
        {isActive && (
          <div className="absolute inset-0 animate-pulse opacity-10 bg-white" />
        )}

        {/* Иконка статуса поверх */}
        {isActive && (
          <span className="absolute top-2 left-2 text-2xl animate-bounce"
            style={{ animationDuration: '2s' }}>
            {STATUS_ICON[status]}
          </span>
        )}

        {/* Бейдж «ГОТОВО» */}
        {isReady && (
          <div className="absolute top-2 right-2 bg-amber-500 text-brown-950 text-xs font-black px-2 py-0.5 rounded-full shadow">
            ГОТОВО
          </div>
        )}
      </div>

      <div className="p-3 space-y-2.5 flex-1">
        {/* Название */}
        <div>
          <h3 className="text-cream-100 font-bold text-sm leading-tight truncate">{name}</h3>
          {styleName && <p className="text-amber-400 text-xs mt-0.5 truncate">{styleName}</p>}
        </div>

        {/* Активный этап: таймер + прогресс-бар + подсказка "что будет дальше" */}
        {isActive && (
          <div className="space-y-1.5">
            {/* Статус + таймер */}
            <div className="flex items-center justify-between">
              <span className="text-cream-100 text-xs font-semibold">
                {STATUS_ICON[status]} {STATUS_LABEL[status]}
              </span>
              <span className={`font-mono font-bold text-xs ${
                seconds < 60 ? 'text-amber-400 animate-pulse' : 'text-cream-100'
              }`}>
                {seconds > 0 ? formatCountdown(seconds) : '…'}
              </span>
            </div>

            {/* Прогресс-бар */}
            <StageProgress
              secondsLeft={seconds}
              status={status as ActiveStatus}
            />

            {/* Что будет дальше */}
            <p className="text-cream-200 text-xs opacity-40">
              {NEXT_LABEL[status as ActiveStatus]}
            </p>
          </div>
        )}

        {/* Готово: качество + призыв к действию */}
        {isReady && (
          <div className="space-y-2">
            {quality != null && (
              <div>
                <div className="flex justify-between text-xs text-cream-200 mb-1">
                  <span>Качество</span>
                  <span className={`font-bold ${
                    quality >= 85 ? 'text-hop-400'
                    : quality >= 70 ? 'text-amber-400'
                    : 'text-cream-100'
                  }`}>{quality}</span>
                </div>
                <div className="h-1.5 rounded-full bg-brown-800">
                  <div
                    className={`h-1.5 rounded-full ${
                      quality >= 85 ? 'bg-hop-500' : quality >= 70 ? 'bg-amber-500' : 'bg-brown-600'
                    }`}
                    style={{ width: `${quality}%` }}
                  />
                </div>
              </div>
            )}
            {(ibu != null || abv != null) && (
              <div className="flex gap-2 text-xs text-cream-200">
                {abv != null && <span>ABV <strong className="text-cream-100">{abv}%</strong></span>}
                {ibu != null && <span>IBU <strong className="text-cream-100">{ibu}</strong></span>}
              </div>
            )}
            <div className="bg-amber-600/20 border border-amber-600/50 rounded-lg px-2 py-1.5 text-center">
              <p className="text-amber-400 text-xs font-semibold">Рынок → Продажа</p>
            </div>
          </div>
        )}

        {/* Пайплайн этапов */}
        <StagePipeline status={status} />
      </div>
    </article>
  )
}
