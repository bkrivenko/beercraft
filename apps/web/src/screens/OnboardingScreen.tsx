import { useState } from 'react'
import { api } from '../lib/api'

// ─── SVG-иллюстрации для каждого слайда ──────────────────────────────────────

function IlluBrewery() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* Фон */}
      <rect width="200" height="160" fill="#1a0e06" rx="12" />
      {/* Кирпичная стена */}
      {[0,18,36,54,72,90,108,126,144].map((y, row) => (
        [0,40,80,120,160].map((x, col) => (
          <rect key={`${row}-${col}`}
            x={x + (row % 2 === 0 ? 0 : 20)} y={y}
            width="36" height="14" rx="2"
            fill={`hsl(20,${30 + (col*3)}%,${12 + (row*0.5)}%)`}
            stroke="#0f0804" strokeWidth="0.5"
          />
        ))
      ))}
      {/* Пол */}
      <rect x="0" y="130" width="200" height="30" fill="#3a1e0a" />
      <rect x="0" y="130" width="200" height="4" fill="#5a3010" />
      {/* Котёл */}
      <ellipse cx="70" cy="88" rx="26" ry="8" fill="#b87333" />
      <rect x="44" y="88" width="52" height="40" fill="#b87333" />
      <ellipse cx="70" cy="128" rx="26" ry="8" fill="#7a4c22" />
      <rect x="44" y="118" width="52" height="12" fill="#7a4c22" />
      {/* Ручки котла */}
      <rect x="36" y="100" width="8" height="5" rx="2" fill="#7a4c22" />
      <rect x="96" y="100" width="8" height="5" rx="2" fill="#7a4c22" />
      {/* Пар */}
      <circle cx="60" cy="74" r="5" fill="white" opacity="0.5">
        <animate attributeName="cy" values="74;55;74" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="72" cy="68" r="6" fill="white" opacity="0.4">
        <animate attributeName="cy" values="68;46;68" dur="2.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="83" cy="72" r="4" fill="white" opacity="0.35">
        <animate attributeName="cy" values="72;52;72" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      {/* Ферментер */}
      <ellipse cx="140" cy="72" rx="20" ry="6" fill="#c8c0b0" />
      <rect x="120" y="72" width="40" height="52" fill="#c8c0b0" />
      <polygon points="120,124 160,124 153,134 127,134" fill="#a09080" />
      <ellipse cx="140" cy="124" rx="20" ry="6" fill="#a09080" />
      <ellipse cx="140" cy="102" rx="9" ry="12" fill="#d4a01780" />
      <ellipse cx="140" cy="102" rx="9" ry="12" fill="none" stroke="#a09080" strokeWidth="1.5" />
      {/* Бульки в ферментере */}
      <circle cx="137" cy="70" r="3" fill="white" opacity="0.4">
        <animate attributeName="cy" values="70;55;70" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite"/>
      </circle>
      {/* Человечек */}
      <rect x="96" y="105" width="10" height="12" rx="3" fill="#d4a060" />
      <rect x="97" y="107" width="8" height="10" rx="1" fill="#7a9a3a" opacity="0.85" />
      <rect x="95" y="96" width="12" height="11" rx="4" fill="#e8c080" />
      <circle cx="99" cy="101" r="1.2" fill="#3a2010" />
      <circle cx="104" cy="101" r="1.2" fill="#3a2010" />
      <rect x="95" y="89" width="12" height="5" rx="1" fill="#5a3010" />
      <rect x="97" y="83" width="8" height="7" rx="2" fill="#5a3010" />
      {/* Мешалка */}
      <line x1="104" y1="109" x2="104" y2="123" stroke="#8b6914" strokeWidth="2"/>
      <line x1="100" y1="123" x2="108" y2="123" stroke="#8b6914" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Ноги */}
      <rect x="96" y="117" width="4" height="8" rx="2" fill="#6a4a2a" />
      <rect x="102" y="117" width="4" height="8" rx="2" fill="#6a4a2a" />
      {/* Ботинки */}
      <rect x="95" y="123" width="6" height="4" rx="2" fill="#3a2010" />
      <rect x="101" y="123" width="6" height="4" rx="2" fill="#3a2010" />
    </svg>
  )
}

function IlluBrew() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <rect width="200" height="160" fill="#1a0e06" rx="12" />
      {/* Этапы варки в ряд */}
      {[
        { x: 25,  icon: '🌾', label: 'Засыпь',   color: '#8b6914' },
        { x: 75,  icon: '🔥', label: 'Варка',    color: '#b84c14' },
        { x: 125, icon: '🧪', label: 'Брожение', color: '#4a7a2a' },
        { x: 175, icon: '❄️', label: 'Выдержка', color: '#2a5a8a' },
      ].map(({ x, icon, label, color }) => (
        <g key={label}>
          <circle cx={x} cy="55" r="22" fill={color} opacity="0.3" />
          <circle cx={x} cy="55" r="20" fill={color} opacity="0.5" stroke={color} strokeWidth="1.5" />
          <text x={x} y="61" textAnchor="middle" fontSize="20">{icon}</text>
          <text x={x} y="94" textAnchor="middle" fontSize="8.5" fill="#c8a060">{label}</text>
        </g>
      ))}
      {/* Стрелки между этапами */}
      {[48, 98, 148].map(x => (
        <g key={x}>
          <line x1={x} y1="55" x2={x+4} y2="55" stroke="#c8a060" strokeWidth="2" opacity="0.6" strokeDasharray="3,2"/>
        </g>
      ))}
      {/* Мини-игра — кнопка */}
      <rect x="50" y="110" width="100" height="36" rx="10" fill="#c8a060" opacity="0.15" stroke="#c8a060" strokeWidth="1.5" strokeDasharray="4,2"/>
      <text x="100" y="124" textAnchor="middle" fontSize="10" fill="#c8a060" fontWeight="bold">МИНИ-ИГРА</text>
      <text x="100" y="138" textAnchor="middle" fontSize="8" fill="#c8a060" opacity="0.7">Точность влияет на качество</text>
      {/* Прогресс-бар */}
      <rect x="50" y="106" width="100" height="4" rx="2" fill="#3a2010" />
      <rect x="50" y="106" width="65" height="4" rx="2" fill="#c8a060" />
      <circle cx="115" cy="108" r="4" fill="#c8a060" />
    </svg>
  )
}

function IlluRecipes() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <rect width="200" height="160" fill="#1a0e06" rx="12" />
      {/* Три карточки рецептов */}
      {[
        { x: 10,  y: 20, name: 'Pale Ale', locked: false,  price: null,  color: '#c8a020' },
        { x: 75,  y: 10, name: 'IPA',      locked: false,  price: 300,   color: '#c86020' },
        { x: 135, y: 20, name: 'Stout',    locked: true,   price: null,  color: '#605040' },
      ].map(({ x, y, name, locked, price, color }) => (
        <g key={name}>
          <rect x={x} y={y} width="55" height="80" rx="8"
            fill={locked ? '#251508' : '#2a1408'}
            stroke={locked ? '#403020' : color}
            strokeWidth={locked ? 1 : 1.5}
            opacity={locked ? 0.5 : 1}
          />
          {!locked && <rect x={x} y={y} width="55" height="28" rx="8" fill={color} opacity="0.25" />}
          <text x={x+27} y={y+18} textAnchor="middle" fontSize={locked ? '18' : '22'}>{locked ? '🔒' : '🍺'}</text>
          <text x={x+27} y={y+44} textAnchor="middle" fontSize="9" fill={locked ? '#605040' : '#c8c0a0'} fontWeight="bold">{name}</text>
          {price && (
            <>
              <rect x={x+8} y={y+58} width="39" height="16" rx="6" fill="#c8a020" opacity="0.9"/>
              <text x={x+27} y={y+70} textAnchor="middle" fontSize="8" fill="#1a0e06" fontWeight="bold">{price} 🪙</text>
            </>
          )}
          {!locked && !price && (
            <text x={x+27} y={y+68} textAnchor="middle" fontSize="8" fill="#6a9a3a">✓ Есть</text>
          )}
        </g>
      ))}
      {/* Подсказка */}
      <rect x="20" y="115" width="160" height="35" rx="8" fill="#2a1a08" stroke="#c8a020" strokeWidth="1" opacity="0.8"/>
      <text x="100" y="129" textAnchor="middle" fontSize="9" fill="#c8c080">Рецепты покупаются в магазине</text>
      <text x="100" y="143" textAnchor="middle" fontSize="8" fill="#c8a020" opacity="0.8">или получаются за заказы 📦</text>
    </svg>
  )
}

function IlluMarket() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <rect width="200" height="160" fill="#1a0e06" rx="12" />
      {/* Вывеска магазина */}
      <rect x="30" y="15" width="140" height="30" rx="6" fill="#5a3010" />
      <rect x="32" y="17" width="136" height="26" rx="5" fill="#3a1a06" />
      <text x="100" y="35" textAnchor="middle" fontSize="13" fill="#c8a020" fontWeight="bold">🏪 РЫНОК ПИВА</text>
      {/* Заказ 1 */}
      <rect x="15" y="55" width="80" height="46" rx="8" fill="#2a1a08" stroke="#c8a020" strokeWidth="1.2"/>
      <text x="55" y="72" textAnchor="middle" fontSize="8" fill="#c8c080" fontWeight="bold">Паб «Хмель»</text>
      <text x="55" y="84" textAnchor="middle" fontSize="8.5">🍺 Pale Ale</text>
      <rect x="25" y="88" width="60" height="10" rx="4" fill="#c8a020" opacity="0.9"/>
      <text x="55" y="97" textAnchor="middle" fontSize="7.5" fill="#1a0e06" fontWeight="bold">180 🪙 + 3 ⭐</text>
      {/* Заказ 2 */}
      <rect x="105" y="55" width="80" height="46" rx="8" fill="#2a1a08" stroke="#d4602080" strokeWidth="1.2"/>
      <text x="145" y="72" textAnchor="middle" fontSize="8" fill="#c8c080" fontWeight="bold">Бар «Солод»</text>
      <text x="145" y="84" textAnchor="middle" fontSize="8.5">🍺 IPA ·  70+ IBU</text>
      <rect x="115" y="88" width="60" height="10" rx="4" fill="#c8702060" />
      <text x="145" y="97" textAnchor="middle" fontSize="7.5" fill="#c8a060" fontWeight="bold">260 🪙 + 5 ⭐</text>
      {/* Монеты анимация */}
      <text x="55" y="120" textAnchor="middle" fontSize="18">
        💰
        <animate attributeName="y" values="120;112;120" dur="2s" repeatCount="indefinite"/>
      </text>
      <text x="90" y="115" textAnchor="middle" fontSize="12">
        🪙
        <animate attributeName="y" values="115;107;115" dur="1.6s" repeatCount="indefinite"/>
      </text>
      <text x="120" y="118" textAnchor="middle" fontSize="14">
        ⭐
        <animate attributeName="y" values="118;110;118" dur="2.2s" repeatCount="indefinite"/>
      </text>
      <text x="100" y="148" textAnchor="middle" fontSize="8.5" fill="#c8a060" opacity="0.8">
        Выполняй заказы — получай монеты и репутацию
      </text>
    </svg>
  )
}

function IlluDuel() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <rect width="200" height="160" fill="#1a0e06" rx="12" />
      {/* VS */}
      <text x="100" y="80" textAnchor="middle" fontSize="32" fill="#c83020" fontWeight="bold" opacity="0.8">VS</text>
      {/* Игрок 1 */}
      <rect x="8" y="30" width="76" height="110" rx="10" fill="#2a180a" stroke="#c8a020" strokeWidth="1.5" opacity="0.9"/>
      <text x="46" y="58" textAnchor="middle" fontSize="22">🧑‍🍳</text>
      <text x="46" y="75" textAnchor="middle" fontSize="8" fill="#c8c080" fontWeight="bold">Ты</text>
      <rect x="18" y="82" width="56" height="8" rx="4" fill="#4a2a10"/>
      <rect x="18" y="82" width="42" height="8" rx="4" fill="#c8a020"/>
      <text x="46" y="102" textAnchor="middle" fontSize="7.5" fill="#c8c080">Качество: 78</text>
      <text x="46" y="115" textAnchor="middle" fontSize="7.5" fill="#6a9a3a">🏆 +50 🪙</text>
      {/* Игрок 2 */}
      <rect x="116" y="30" width="76" height="110" rx="10" fill="#2a180a" stroke="#604020" strokeWidth="1.5" opacity="0.7"/>
      <text x="154" y="58" textAnchor="middle" fontSize="22">👨‍🍳</text>
      <text x="154" y="75" textAnchor="middle" fontSize="8" fill="#c8c080" fontWeight="bold">Соперник</text>
      <rect x="126" y="82" width="56" height="8" rx="4" fill="#4a2a10"/>
      <rect x="126" y="82" width="35" height="8" rx="4" fill="#c06030"/>
      <text x="154" y="102" textAnchor="middle" fontSize="7.5" fill="#c8c080">Качество: 65</text>
      <text x="154" y="115" textAnchor="middle" fontSize="7.5" fill="#804020">😤 проиграл</text>
      {/* Кубок */}
      <text x="46" y="136" textAnchor="middle" fontSize="18">🏆</text>
      <text x="154" y="136" textAnchor="middle" fontSize="16" opacity="0.3">🍺</text>
    </svg>
  )
}

function IlluStart() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <rect width="200" height="160" fill="#1a0e06" rx="12" />
      {/* Звёзды фона */}
      {[[20,20],[60,15],[120,12],[170,25],[40,45],[160,50],[80,8],[140,40],[100,35]].map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill="#c8a020" opacity={0.3 + (i % 3) * 0.2}>
          <animate attributeName="opacity" values={`${0.3 + (i%3)*0.2};0.8;${0.3+(i%3)*0.2}`}
            dur={`${1.5 + i*0.3}s`} repeatCount="indefinite"/>
        </circle>
      ))}
      {/* Большая кружка */}
      <rect x="65" y="35" width="70" height="72" rx="10" fill="#c8a020" opacity="0.15" stroke="#c8a020" strokeWidth="2"/>
      <rect x="65" y="35" width="70" height="72" rx="10" fill="none" stroke="#c8a020" strokeWidth="2"/>
      {/* Пена */}
      {[75,88,100,112,122].map((x, i) => (
        <ellipse key={i} cx={x} cy={37} rx="7" ry={5 + (i%2)*2} fill="white" opacity="0.85"/>
      ))}
      {/* Пиво */}
      <rect x="67" y="45" width="66" height="60" rx="6" fill="#d4a01760"/>
      {/* Блик на кружке */}
      <rect x="72" y="45" width="8" height="50" rx="4" fill="white" opacity="0.1"/>
      {/* Ручка */}
      <path d="M135,55 Q155,55 155,75 Q155,95 135,95" fill="none" stroke="#c8a020" strokeWidth="5" strokeLinecap="round"/>
      <path d="M135,55 Q155,55 155,75 Q155,95 135,95" fill="none" stroke="#1a0e06" strokeWidth="2"/>
      {/* Пузырьки */}
      {[[85,90],[95,80],[110,85],[105,95]].map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill="white" opacity="0.3">
          <animate attributeName="cy" values={`${cy};${cy-20};${cy}`} dur={`${1+i*0.4}s`} repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0;0.3" dur={`${1+i*0.4}s`} repeatCount="indefinite"/>
        </circle>
      ))}
      {/* Текст */}
      <text x="100" y="125" textAnchor="middle" fontSize="13" fill="#c8a020" fontWeight="bold">Твоя пивоварня</text>
      <text x="100" y="140" textAnchor="middle" fontSize="9" fill="#c8a060" opacity="0.8">ждёт тебя!</text>
    </svg>
  )
}

// ─── Данные слайдов ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    illustration: IlluBrewery,
    title: 'Добро пожаловать в BeerCraft!',
    text:  'Ты — хозяин пивоварни. Вари крафтовое пиво, прокачивай оборудование и стань лучшим пивоваром!',
    accent: '#c8a020',
  },
  {
    illustration: IlluBrew,
    title: 'Как варить пиво',
    text:  'Выбери рецепт → добавь солод, хмель и дрожжи → пройди мини-игру варки. Точность влияет на качество!',
    accent: '#c86020',
  },
  {
    illustration: IlluRecipes,
    title: 'Рецепты нужно получать',
    text:  'Рецепты не выдаются автоматически. Покупай их в магазине за монеты или получай за выполнение заказов.',
    accent: '#d4a017',
  },
  {
    illustration: IlluMarket,
    title: 'Рынок и заказы',
    text:  'Продавай готовое пиво на рынке. Выполняй заказы NPC — за это дают монеты, репутацию и иногда новые рецепты!',
    accent: '#c8a020',
  },
  {
    illustration: IlluDuel,
    title: 'Дуэли',
    text:  'Соревнуйся с другими игроками! Получаешь задание на стиль пива — у кого качество выше, тот и победил.',
    accent: '#c83020',
  },
  {
    illustration: IlluStart,
    title: 'Готов начать?',
    text:  'Тебе уже выдан стартовый набор: 500 монет и ингредиенты на первую варку. Удачи, пивовар!',
    accent: '#6a9a3a',
  },
]

// ─── Компонент точек-пагинации ──────────────────────────────────────────────

function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 h-2 bg-amber-500'
              : i < current
              ? 'w-2 h-2 bg-amber-700'
              : 'w-2 h-2 bg-brown-700'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────

interface OnboardingScreenProps {
  onDone: () => void
}

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [step,     setStep]     = useState(0)
  const [exiting,  setExiting]  = useState(false)
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')

  const slide = SLIDES[step]
  const Illu  = slide.illustration
  const isLast = step === SLIDES.length - 1

  const goNext = () => {
    if (isLast) {
      handleFinish()
      return
    }
    setSlideDir('left')
    setStep(s => s + 1)
  }

  const goPrev = () => {
    if (step === 0) return
    setSlideDir('right')
    setStep(s => s - 1)
  }

  const handleFinish = async () => {
    setExiting(true)
    try {
      await api.completeOnboarding()
    } catch (_) { /* ignore */ }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-brown-950 flex flex-col overflow-hidden">
      {/* Кнопка пропустить */}
      <div className="flex justify-end px-5 pt-4 pb-2">
        {!isLast && (
          <button
            onClick={handleFinish}
            className="text-cream-200 text-sm opacity-40 active:opacity-70"
          >
            Пропустить
          </button>
        )}
      </div>

      {/* Иллюстрация */}
      <div className="px-6 flex-shrink-0">
        <div
          className={`w-full rounded-2xl overflow-hidden transition-all duration-300 ${
            exiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
          style={{ aspectRatio: '200/160' }}
        >
          <Illu />
        </div>
      </div>

      {/* Контент */}
      <div
        key={step}
        className="flex-1 flex flex-col px-6 pt-5 pb-4 overflow-hidden"
        style={{
          animation: `slideIn${slideDir === 'left' ? 'Right' : 'Left'} 0.25s ease-out`,
        }}
      >
        {/* Заголовок */}
        <h1
          className="text-cream-100 font-black text-2xl leading-tight text-center"
          style={{ color: slide.accent }}
        >
          {slide.title}
        </h1>

        {/* Текст */}
        <p className="text-cream-200 text-sm leading-relaxed text-center mt-3 opacity-80">
          {slide.text}
        </p>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Пагинация */}
        <Dots total={SLIDES.length} current={step} />

        {/* Кнопки навигации */}
        <div className="flex gap-3 mt-4">
          {step > 0 && (
            <button
              onClick={goPrev}
              className="flex-1 py-3.5 rounded-2xl border border-brown-700 text-cream-200 font-semibold text-base active:opacity-70"
            >
              ‹ Назад
            </button>
          )}
          <button
            onClick={goNext}
            className={`py-3.5 rounded-2xl font-black text-base active:opacity-80 transition-colors shadow-lg ${
              step === 0 ? 'flex-1' : 'flex-1'
            }`}
            style={{ backgroundColor: slide.accent, color: '#1a0e06' }}
          >
            {isLast ? '🍺 Поехали!' : 'Далее →'}
          </button>
        </div>
      </div>

      {/* CSS анимации */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
