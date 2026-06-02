import { useCountdown, formatCountdown } from '../lib/useApi'
import { srmToHex } from '../lib/brewCalc'

export interface BeerCardProps {
  id: string
  name: string
  styleName: string | null
  ibu: number | null
  abv: number | null
  quality: number | null
  srm: number | null
  status: 'mashing' | 'boiling' | 'fermenting' | 'conditioning' | 'ready' | 'sold'
  readyAt: string | null
  onClick?: () => void
}

const STATUS_LABEL: Record<BeerCardProps['status'], string> = {
  mashing:      '🌾 Затирание',
  boiling:      '🔥 Варка',
  fermenting:   '🧪 Брожение',
  conditioning: '❄️ Выдержка',
  ready:        '✅ Готово',
  sold:         '💰 Продано',
}

const STATUS_COLOR: Record<BeerCardProps['status'], string> = {
  mashing:      'bg-amber-500 text-brown-950',
  boiling:      'bg-amber-600 text-brown-950',
  fermenting:   'bg-hop-700 text-cream-100',
  conditioning: 'bg-hop-900 text-cream-100',
  ready:        'bg-hop-600 text-cream-100',
  sold:         'bg-brown-800 text-cream-200',
}

function BeerColorBlock({ srm, status }: { srm: number | null; status: BeerCardProps['status'] }) {
  const color = srm != null ? srmToHex(srm) : '#4e2a0e'
  const isActive = ['mashing', 'boiling', 'fermenting', 'conditioning'].includes(status)

  return (
    <div
      className="w-full h-20 rounded-t-xl flex items-center justify-center relative overflow-hidden"
      style={{ background: color }}
    >
      <span className="text-3xl select-none">{isActive ? '⏳' : '🍺'}</span>
      {/* пульс для активных */}
      {isActive && (
        <div className="absolute inset-0 animate-pulse opacity-10 bg-white rounded-t-xl" />
      )}
    </div>
  )
}

function Timer({ readyAt, status }: { readyAt: string | null; status: BeerCardProps['status'] }) {
  const seconds = useCountdown(readyAt)
  const active  = readyAt && ['mashing','boiling','fermenting','conditioning'].includes(status)
  if (!active) return null

  return (
    <div className="flex items-center gap-1 text-amber-400 text-xs font-mono font-bold">
      <span>⏱</span>
      <span>{formatCountdown(seconds)}</span>
    </div>
  )
}

export function BeerCard({ name, styleName, ibu, abv, quality, srm, status, readyAt, onClick }: BeerCardProps) {
  return (
    <article
      className={`bg-brown-900 rounded-xl overflow-hidden border border-brown-800 shadow-lg
        ${onClick ? 'cursor-pointer active:opacity-80' : ''}`}
      onClick={onClick}
    >
      <BeerColorBlock srm={srm} status={status} />

      <div className="p-3 space-y-2">
        <div>
          <h3 className="text-cream-100 font-bold text-sm leading-tight truncate">{name}</h3>
          {styleName && <p className="text-amber-400 text-xs mt-0.5 truncate">{styleName}</p>}
        </div>

        {/* Параметры (только если уже есть) */}
        {(ibu != null || abv != null) && (
          <div className="flex gap-3 text-xs text-cream-200">
            {ibu  != null && <span>IBU <strong className="text-cream-100">{ibu}</strong></span>}
            {abv  != null && <span>ABV <strong className="text-cream-100">{abv}%</strong></span>}
          </div>
        )}

        {/* Полоса качества */}
        {quality != null && (
          <div>
            <div className="flex justify-between text-xs text-cream-200 mb-1">
              <span>Качество</span>
              <span className="text-amber-400 font-bold">{quality}</span>
            </div>
            <div className="h-1.5 rounded-full bg-brown-800">
              <div
                className="h-1.5 rounded-full bg-amber-600 transition-all duration-500"
                style={{ width: `${quality}%` }}
              />
            </div>
          </div>
        )}

        {/* Статус + таймер */}
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <Timer readyAt={readyAt} status={status} />
        </div>

        {/* Кнопка для ready */}
        {status === 'ready' && (
          <button className="w-full bg-amber-600 text-brown-950 text-xs font-bold py-1.5 rounded-lg mt-1 active:opacity-80">
            Забрать
          </button>
        )}
      </div>
    </article>
  )
}
