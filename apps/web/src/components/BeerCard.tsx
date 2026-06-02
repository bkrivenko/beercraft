interface BeerCardProps {
  name: string
  style: string
  ibu: number
  abv: number
  quality: number   // 0–100
  status: 'mashing' | 'boiling' | 'fermenting' | 'conditioning' | 'ready' | 'sold'
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

// Цветной блок вместо картинки — оттенок зависит от качества
function BeerColorBlock({ quality }: { quality: number }) {
  // quality 0–100 → цвет от тёмного коричневого к янтарному
  const hue = Math.round(25 + quality * 0.15)   // 25–40 deg (коричнево-янтарная гамма)
  const lightness = Math.round(20 + quality * 0.3) // 20–50%
  const style = { background: `hsl(${hue}, 75%, ${lightness}%)` }

  return (
    <div
      className="w-full h-24 rounded-t-xl flex items-center justify-center"
      style={style}
    >
      <span className="text-4xl select-none">🍺</span>
    </div>
  )
}

export function BeerCard({ name, style, ibu, abv, quality, status }: BeerCardProps) {
  return (
    <article className="bg-brown-900 rounded-xl overflow-hidden border border-brown-800 shadow-lg">
      <BeerColorBlock quality={quality} />

      <div className="p-3 space-y-2">
        {/* Название + стиль */}
        <div>
          <h3 className="text-cream-100 font-bold text-base leading-tight">{name}</h3>
          <p className="text-amber-400 text-xs mt-0.5">{style}</p>
        </div>

        {/* Параметры */}
        <div className="flex gap-3 text-xs text-cream-200">
          <span>IBU <strong className="text-cream-100">{ibu}</strong></span>
          <span>ABV <strong className="text-cream-100">{abv}%</strong></span>
        </div>

        {/* Полоса качества */}
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

        {/* Статус */}
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
    </article>
  )
}
