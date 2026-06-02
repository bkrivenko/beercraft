import type { BrewPreview, StyleRange, ParamStatus } from '../lib/brewCalc'
import { getParamStatus, srmToHex } from '../lib/brewCalc'

interface ParamPanelProps {
  preview: BrewPreview
  styleRange?: StyleRange
  showStyleMatch?: boolean
  styleMatchPct?: number
}

interface StatProps {
  label: string
  value: string
  status?: ParamStatus
}

function Stat({ label, value, status = 'unknown' }: StatProps) {
  const color =
    status === 'ok'      ? 'text-cream-100'
    : status === 'low'   ? 'text-amber-400'
    : status === 'high'  ? 'text-red-400'
    : 'text-cream-200'

  const dot =
    status === 'ok'     ? '🟢'
    : status === 'low'  ? '🔻'
    : status === 'high' ? '🔺'
    : ''

  return (
    <div className="flex flex-col items-center">
      <span className={`font-bold text-base leading-tight ${color}`}>
        {dot && <span className="text-xs mr-0.5">{dot}</span>}
        {value}
      </span>
      <span className="text-cream-200 text-xs opacity-60">{label}</span>
    </div>
  )
}

export function ParamPanel({
  preview,
  styleRange,
  showStyleMatch = false,
  styleMatchPct,
}: ParamPanelProps) {
  const beerColor = srmToHex(preview.srm)

  const ogStatus  = getParamStatus(preview.og,  styleRange?.og)
  const fgStatus  = getParamStatus(preview.fg,  styleRange?.fg)
  const abvStatus = getParamStatus(preview.abv, styleRange?.abv)
  const ibuStatus = getParamStatus(preview.ibu, styleRange?.ibu)
  const srmStatus = getParamStatus(preview.srm, styleRange?.srm)

  return (
    <div className="bg-brown-900 border border-brown-800 rounded-xl p-4 space-y-3">
      {/* Строка параметров */}
      <div className="grid grid-cols-5 gap-1">
        <Stat label="OG"  value={preview.og.toFixed(3)}  status={ogStatus} />
        <Stat label="FG"  value={preview.fg.toFixed(3)}  status={fgStatus} />
        <Stat label="ABV" value={`${preview.abv.toFixed(1)}%`} status={abvStatus} />
        <Stat label="IBU" value={String(preview.ibu)}    status={ibuStatus} />
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            {/* Цветной кружок SRM */}
            <span
              className="inline-block w-3 h-3 rounded-full border border-brown-800"
              style={{ background: beerColor }}
            />
            <span className={`font-bold text-base leading-tight ${
              srmStatus === 'ok' ? 'text-cream-100'
              : srmStatus === 'low' ? 'text-amber-400'
              : srmStatus === 'high' ? 'text-red-400'
              : 'text-cream-200'
            }`}>{preview.srm.toFixed(1)}</span>
          </div>
          <span className="text-cream-200 text-xs opacity-60">SRM</span>
        </div>
      </div>

      {/* BU:GU */}
      <div className="flex items-center gap-2 text-xs text-cream-200 opacity-60">
        <span>BU:GU {preview.bugu.toFixed(2)}</span>
        <span>·</span>
        <span>GP {preview.gp.toFixed(1)}</span>
      </div>

      {/* StyleMatchBar */}
      {showStyleMatch && styleMatchPct !== undefined && (
        <div>
          <div className="flex justify-between text-xs text-cream-200 mb-1">
            <span>Соответствие стилю</span>
            <span className="text-amber-400 font-bold">{styleMatchPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-brown-800">
            <div
              className="h-2 rounded-full bg-amber-600 transition-all duration-300"
              style={{ width: `${styleMatchPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
