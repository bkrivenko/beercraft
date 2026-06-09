import { useState, useEffect, useRef, useCallback } from 'react'
import { api, type EquipmentItem, type Batch } from '../lib/api'

// ─── Конфигурация оборудования (фронтенд) ─────────────────────────────────────

interface EquipDef {
  name: string
  unlockLevel: number
  buyPrice: number
  maxLevel: number
  upgradePrices: number[]
  upgradeLevelReq: number[]
  descriptions: string[]
  bonuses: string[]
  sceneX: number    // позиция в сцене
  sceneW: number    // ширина в сцене
  drawHeight: number
}

const EQUIP_DEFS: Record<string, EquipDef> = {
  kettle:           { name: 'Варочный котёл',  unlockLevel: 1, buyPrice: 0,    maxLevel: 3, upgradePrices: [300, 600],   upgradeLevelReq: [2, 4], descriptions: ['Медный котёл 50 л','Котёл 100 л','Проф. котёл 200 л'], bonuses: ['Базовое качество','+5% качество','+10% качество'], sceneX: 48,  sceneW: 52, drawHeight: 70 },
  fermenter:        { name: 'Ферментер',        unlockLevel: 1, buyPrice: 0,    maxLevel: 3, upgradePrices: [250, 500],   upgradeLevelReq: [2, 4], descriptions: ['Пластиковый','Стальной','Конический'],              bonuses: ['Базовое брожение','+5% атт.','+10% атт.'],           sceneX: 128, sceneW: 44, drawHeight: 80 },
  mash_tun:         { name: 'Заторный бак',     unlockLevel: 3, buyPrice: 400,  maxLevel: 2, upgradePrices: [700],        upgradeLevelReq: [5],    descriptions: ['Заторный бак 80 л','Бак 150 л'],                   bonuses: ['+5% экстракт','+12% экстракт'],                      sceneX: 200, sceneW: 50, drawHeight: 60 },
  hop_back:         { name: 'Хмелевой бак',     unlockLevel: 5, buyPrice: 600,  maxLevel: 2, upgradePrices: [1000],       upgradeLevelReq: [7],    descriptions: ['Хмелевой бак','Бак с фильтром'],                   bonuses: ['+5% IBU точн.','+10% IBU точн.'],                    sceneX: 265, sceneW: 40, drawHeight: 55 },
  conditioning_tank:{ name: 'Чан выдержки',     unlockLevel: 6, buyPrice: 700,  maxLevel: 2, upgradePrices: [1200],       upgradeLevelReq: [9],    descriptions: ['Чан 100 л','Охлаждаемый 200 л'],                   bonuses: ['-15% время','-30% время'],                           sceneX: 316, sceneW: 48, drawHeight: 65 },
}

// Порядок оборудования в сцене (слева направо)
const EQUIP_ORDER = ['kettle', 'fermenter', 'mash_tun', 'hop_back', 'conditioning_tank']

// ─── SVG: Варочный котёл ───────────────────────────────────────────────────────

function KettleSVG({ cx, level, isActive }: { cx: number; level: number; isActive: boolean }) {
  const w = 46 + (level - 1) * 6
  const h = 62 + (level - 1) * 8
  const x = cx - w / 2
  const floorY = 195
  const topY = floorY - h
  const copperColor = level === 1 ? '#b87333' : level === 2 ? '#c0c0c0' : '#8090a0'
  const darkColor   = level === 1 ? '#7a4c22' : level === 2 ? '#808080' : '#506070'

  return (
    <g>
      {/* Тело котла — цилиндр */}
      <ellipse cx={cx} cy={topY + 6} rx={w / 2} ry={6} fill={copperColor} />
      <rect x={x} y={topY + 6} width={w} height={h - 12} fill={copperColor} />
      <ellipse cx={cx} cy={floorY - 6} rx={w / 2} ry={6} fill={darkColor} />
      {/* Нижняя ножка */}
      <rect x={cx - 4} y={floorY - 8} width={8} height={8} rx={2} fill={darkColor} />
      {/* Полосы на котле */}
      {[0.3, 0.6].map((t, i) => (
        <rect key={i} x={x} y={topY + 6 + (h - 12) * t - 2} width={w} height={3} fill={darkColor} opacity={0.35} />
      ))}
      {/* Ручки */}
      <rect x={x - 8} y={topY + h * 0.4} width={8} height={5} rx={2} fill={darkColor} />
      <rect x={x + w} y={topY + h * 0.4} width={8} height={5} rx={2} fill={darkColor} />
      {/* Крышка */}
      <ellipse cx={cx} cy={topY + 2} rx={w / 2 + 2} ry={7} fill={darkColor} />
      <ellipse cx={cx} cy={topY - 2} rx={6} ry={4} fill={darkColor} />
      {/* Кран */}
      <rect x={x + w - 2} y={floorY - 20} width={12} height={5} rx={2} fill={darkColor} />
      <circle cx={x + w + 10} cy={floorY - 17} r={4} fill={darkColor} />
      {/* Пар, если активен */}
      {isActive && (
        <>
          <circle cx={cx - 8} cy={topY - 12} r={4} fill="white" opacity={0.6}>
            <animate attributeName="cy" values={`${topY - 12};${topY - 28};${topY - 12}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx + 2} cy={topY - 18} r={5} fill="white" opacity={0.5}>
            <animate attributeName="cy" values={`${topY - 18};${topY - 38};${topY - 18}`} dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx + 12} cy={topY - 10} r={3} fill="white" opacity={0.4}>
            <animate attributeName="cy" values={`${topY - 10};${topY - 26};${topY - 10}`} dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {/* Уровень */}
      {level > 1 && (
        <text x={cx} y={topY + h * 0.55} textAnchor="middle" fontSize="10" fill="white" opacity={0.7} fontWeight="bold">
          Ур.{level}
        </text>
      )}
    </g>
  )
}

// ─── SVG: Ферментер ─────────────────────────────────────────────────────────────

function FermenterSVG({ cx, level, isActive }: { cx: number; level: number; isActive: boolean }) {
  const w = 38 + (level - 1) * 4
  const h = 72 + (level - 1) * 10
  const x = cx - w / 2
  const floorY = 195
  const topY = floorY - h
  const color   = level === 1 ? '#e8e0c8' : level === 2 ? '#d0d8e0' : '#b8c8d8'
  const dark    = level === 1 ? '#a09880' : level === 2 ? '#8090a0' : '#608090'
  const beerClr = isActive ? '#d4a017' : '#806040'

  return (
    <g>
      {/* Конус снизу */}
      <polygon
        points={`${cx - w / 2},${floorY - 16} ${cx + w / 2},${floorY - 16} ${cx + 6},${floorY} ${cx - 6},${floorY}`}
        fill={dark}
      />
      {/* Тело */}
      <rect x={x} y={topY + 8} width={w} height={h - 24} fill={color} />
      <ellipse cx={cx} cy={topY + 8} rx={w / 2} ry={8} fill={color} />
      <ellipse cx={cx} cy={floorY - 16} rx={w / 2} ry={8} fill={dark} />
      {/* Смотровое окошко */}
      <ellipse cx={cx} cy={topY + h * 0.45} rx={9} ry={12} fill={beerClr} opacity={0.7} />
      <ellipse cx={cx} cy={topY + h * 0.45} rx={9} ry={12} fill="none" stroke={dark} strokeWidth={1.5} />
      {/* Крышка */}
      <ellipse cx={cx} cy={topY + 4} rx={w / 2 + 2} ry={6} fill={dark} />
      <rect x={cx - 3} y={topY - 6} width={6} height={10} rx={2} fill={dark} />
      {/* Труба сбоку */}
      <rect x={x + w - 2} y={topY + h * 0.7} width={14} height={4} rx={2} fill={dark} />
      {/* Кольца */}
      {[0.25, 0.75].map((t, i) => (
        <rect key={i} x={x} y={topY + 8 + (h - 24) * t} width={w} height={3} fill={dark} opacity={0.3} />
      ))}
      {/* Бульки если брожение */}
      {isActive && (
        <>
          <circle cx={cx - 3} cy={topY} r={3} fill="white" opacity={0.5}>
            <animate attributeName="cy" values={`${topY};${topY - 15};${topY}`} dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx + 5} cy={topY - 5} r={2} fill="white" opacity={0.4}>
            <animate attributeName="cy" values={`${topY - 5};${topY - 20};${topY - 5}`} dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="2.2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {level > 1 && (
        <text x={cx} y={topY + h * 0.55} textAnchor="middle" fontSize="9" fill={dark} opacity={0.8} fontWeight="bold">
          Ур.{level}
        </text>
      )}
    </g>
  )
}

// ─── SVG: Заторный бак ────────────────────────────────────────────────────────

function MashTunSVG({ cx, level }: { cx: number; level: number }) {
  const w = 48 + (level - 1) * 6
  const h = 46 + (level - 1) * 6
  const x = cx - w / 2
  const floorY = 195
  const topY = floorY - h
  const color = '#8b6914'
  const dark  = '#5a4510'

  return (
    <g>
      <ellipse cx={cx} cy={topY + 5} rx={w / 2} ry={5} fill={color} />
      <rect x={x} y={topY + 5} width={w} height={h - 10} fill={color} />
      <ellipse cx={cx} cy={floorY - 5} rx={w / 2} ry={5} fill={dark} />
      {/* Деревянные доски-полосы */}
      {[0.2, 0.4, 0.6, 0.8].map((t, i) => (
        <rect key={i} x={x} y={topY + 5 + (h - 10) * t} width={w} height={2} fill={dark} opacity={0.4} />
      ))}
      {/* Обруч */}
      {[0.3, 0.7].map((t, i) => (
        <rect key={i} x={x - 2} y={topY + 5 + (h - 10) * t - 1} width={w + 4} height={4} rx={1} fill={dark} opacity={0.6} />
      ))}
      {/* Кран внизу */}
      <rect x={x + w - 4} y={floorY - 14} width={14} height={5} rx={2} fill={dark} />
      {level > 1 && (
        <text x={cx} y={topY + h * 0.55} textAnchor="middle" fontSize="9" fill="white" opacity={0.7} fontWeight="bold">
          Ур.{level}
        </text>
      )}
    </g>
  )
}

// ─── SVG: Хмелевой бак ────────────────────────────────────────────────────────

function HopBackSVG({ cx, level }: { cx: number; level: number }) {
  const w = 34 + (level - 1) * 4
  const h = 50 + (level - 1) * 5
  const x = cx - w / 2
  const floorY = 195
  const topY = floorY - h
  const color = '#5a7a3a'
  const dark  = '#3a5020'

  return (
    <g>
      {/* Цилиндр */}
      <ellipse cx={cx} cy={topY + 5} rx={w / 2} ry={5} fill={color} />
      <rect x={x} y={topY + 5} width={w} height={h - 10} fill={color} />
      <ellipse cx={cx} cy={floorY - 5} rx={w / 2} ry={5} fill={dark} />
      {/* Хмелевые шишки декор */}
      <circle cx={cx - 6} cy={topY + 18} r={5} fill="#7a9a4a" />
      <circle cx={cx + 5} cy={topY + 14} r={4} fill="#7a9a4a" />
      <circle cx={cx} cy={topY + 22} r={4} fill="#6a8a3a" />
      {/* Трубки */}
      <rect x={x - 10} y={topY + h * 0.5} width={10} height={4} rx={2} fill={dark} />
      <rect x={x + w} y={topY + h * 0.5} width={10} height={4} rx={2} fill={dark} />
      {level > 1 && (
        <text x={cx} y={topY + h * 0.75} textAnchor="middle" fontSize="9" fill="white" opacity={0.7} fontWeight="bold">
          Ур.{level}
        </text>
      )}
    </g>
  )
}

// ─── SVG: Чан выдержки ────────────────────────────────────────────────────────

function CondTankSVG({ cx, level }: { cx: number; level: number }) {
  const w = 46 + (level - 1) * 6
  const h = 58 + (level - 1) * 8
  const x = cx - w / 2
  const floorY = 195
  const topY = floorY - h
  const color = '#607090'
  const dark  = '#405060'
  const ice   = '#b0d8f0'

  return (
    <g>
      <ellipse cx={cx} cy={topY + 6} rx={w / 2} ry={6} fill={color} />
      <rect x={x} y={topY + 6} width={w} height={h - 12} fill={color} />
      <ellipse cx={cx} cy={floorY - 6} rx={w / 2} ry={6} fill={dark} />
      {/* Льдинки */}
      {level >= 2 && (
        <>
          <polygon points={`${cx - 10},${topY + h * 0.3} ${cx - 6},${topY + h * 0.2} ${cx - 2},${topY + h * 0.35}`} fill={ice} opacity={0.6} />
          <polygon points={`${cx + 4},${topY + h * 0.4} ${cx + 9},${topY + h * 0.28} ${cx + 13},${topY + h * 0.45}`} fill={ice} opacity={0.5} />
        </>
      )}
      {/* Термометр */}
      <rect x={cx + w / 2 - 14} y={topY + h * 0.3} width={5} height={18} rx={2} fill="white" opacity={0.8} />
      <rect x={cx + w / 2 - 13} y={topY + h * 0.3 + 4} width={3} height={10} rx={1} fill={ice} />
      {/* Ножки */}
      <rect x={cx - w / 2 + 4} y={floorY - 6} width={6} height={8} fill={dark} />
      <rect x={cx + w / 2 - 10} y={floorY - 6} width={6} height={8} fill={dark} />
      {level > 1 && (
        <text x={cx} y={topY + h * 0.6} textAnchor="middle" fontSize="9" fill="white" opacity={0.7} fontWeight="bold">
          Ур.{level}
        </text>
      )}
    </g>
  )
}

// ─── SVG: Заглушка "Заблокировано" ────────────────────────────────────────────

function LockedEquipSVG({ cx, name, level: reqLevel, buyPrice }: { cx: number; name: string; level: number; buyPrice: number }) {
  const floorY = 195
  return (
    <g opacity={0.4}>
      <rect x={cx - 22} y={floorY - 50} width={44} height={50} rx={4} fill="#302010" stroke="#604020" strokeWidth={1} strokeDasharray="3,3" />
      <text x={cx} y={floorY - 28} textAnchor="middle" fontSize="16" fill="#a08060">🔒</text>
      <text x={cx} y={floorY - 14} textAnchor="middle" fontSize="7" fill="#a08060">Ур.{reqLevel}</text>
      <text x={cx} y={floorY - 5}  textAnchor="middle" fontSize="6.5" fill="#806040">{name}</text>
      {buyPrice > 0 && (
        <text x={cx} y={floorY + 5} textAnchor="middle" fontSize="7" fill="#d4a017">{buyPrice}🪙</text>
      )}
    </g>
  )
}

// ─── SVG: Заглушка "Купить" ───────────────────────────────────────────────────

function BuyEquipSVG({ cx, name, buyPrice, onClick }: { cx: number; name: string; buyPrice: number; onClick: () => void }) {
  const floorY = 195
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }} opacity={0.75}>
      <rect x={cx - 24} y={floorY - 54} width={48} height={54} rx={6} fill="#1e2a10" stroke="#6a9020" strokeWidth={1.5} strokeDasharray="4,2" />
      <text x={cx} y={floorY - 32} textAnchor="middle" fontSize="20">➕</text>
      <text x={cx} y={floorY - 16} textAnchor="middle" fontSize="7" fill="#a0c060">{name}</text>
      <text x={cx} y={floorY - 5}  textAnchor="middle" fontSize="8" fontWeight="bold" fill="#d4a017">{buyPrice}🪙</text>
    </g>
  )
}

// ─── SVG: Человечек ──────────────────────────────────────────────────────────

type CharAnim = 'walk' | 'stir' | 'sweep' | 'idle' | 'check' | 'excited'

function CharacterSVG({ x, dir, anim, frame }: { x: number; dir: 1 | -1; anim: CharAnim; frame: number }) {
  const floorY = 195
  // Масштаб относительно floorY
  const hy = floorY - 26  // высота головы
  const by = floorY - 15  // тело верх
  const bh = 13           // тело высота
  const ly = floorY - 2   // ноги верх

  // Ходьба: ноги чередуются
  const legL = anim === 'walk' ? (frame === 0 ? -4 : 0) : (anim === 'excited' ? (frame === 0 ? -3 : 3) : 0)
  const legR = anim === 'walk' ? (frame === 0 ? 0 : -4) : (anim === 'excited' ? (frame === 0 ? 3 : -3) : 0)

  // Руки: для разных анимаций
  let armLAngle = 0
  let armRAngle = 0
  if (anim === 'stir')    { armLAngle = frame === 0 ? -30 : 30; armRAngle = frame === 0 ? 30 : -30 }
  if (anim === 'sweep')   { armLAngle = frame === 0 ? -20 : 20; armRAngle = -20 }
  if (anim === 'walk')    { armLAngle = frame === 0 ? -25 : 25; armRAngle = frame === 0 ? 25 : -25 }
  if (anim === 'excited') { armLAngle = -60; armRAngle = -60 }
  if (anim === 'check')   { armRAngle = -40 }

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const armLen = 9
  // Левая рука
  const alx = x - 5 * dir + Math.sin(toRad(armLAngle * dir)) * armLen
  const aly = by + 4 + Math.cos(toRad(armLAngle)) * armLen
  // Правая рука
  const arx = x + 5 * dir + Math.sin(toRad(armRAngle * dir)) * armLen
  const ary = by + 4 + Math.cos(toRad(armRAngle)) * armLen

  // Зеркальное отражение, если идёт влево
  const transform = dir === -1 ? `scale(-1,1) translate(${-2 * x},0)` : ''

  return (
    <g transform={transform}>
      {/* Фартук */}
      <rect x={x - 4} y={by + 2} width={8} height={bh - 2} rx={1} fill="#7a9a3a" opacity={0.85} />
      {/* Тело */}
      <rect x={x - 5} y={by} width={10} height={bh} rx={3} fill="#d4a060" />
      {/* Голова */}
      <rect x={x - 6} y={hy} width={12} height={12} rx={4} fill="#e8c080" />
      {/* Глаза */}
      <circle cx={x - 2} cy={hy + 5} r={1.2} fill="#3a2010" />
      <circle cx={x + 3} cy={hy + 5} r={1.2} fill="#3a2010" />
      {/* Рот — улыбается */}
      {anim !== 'idle' && (
        <path d={`M${x - 2},${hy + 9} Q${x + 1},${hy + 11} ${x + 3},${hy + 9}`} stroke="#3a2010" strokeWidth={0.8} fill="none" />
      )}
      {/* Пивоварская шапка */}
      <rect x={x - 6} y={hy - 8} width={12} height={5} rx={1} fill="#5a3010" />
      <rect x={x - 4} y={hy - 14} width={8} height={7} rx={2} fill="#5a3010" />
      {/* Левая рука */}
      <line x1={x - 4} y1={by + 4} x2={alx} y2={aly} stroke="#d4a060" strokeWidth={3} strokeLinecap="round" />
      {/* Правая рука */}
      <line x1={x + 4} y1={by + 4} x2={arx} y2={ary} stroke="#d4a060" strokeWidth={3} strokeLinecap="round" />
      {/* Инструмент (мешалка при варке, метла при уборке) */}
      {anim === 'stir' && (
        <line x1={arx} y1={ary} x2={arx} y2={ary + 14} stroke="#8b6914" strokeWidth={2} strokeLinecap="round" />
      )}
      {anim === 'sweep' && (
        <>
          <line x1={alx} y1={aly} x2={alx + 2} y2={aly + 16} stroke="#8b6914" strokeWidth={2} />
          <line x1={alx - 4} y1={aly + 16} x2={alx + 8} y2={aly + 16} stroke="#8b6914" strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      {/* Ноги */}
      <rect x={x - 5} y={ly + legL} width={4} height={8} rx={2} fill="#6a4a2a" />
      <rect x={x + 1} y={ly + legR} width={4} height={8} rx={2} fill="#6a4a2a" />
      {/* Ботинки */}
      <rect x={x - 6} y={ly + legL + 6} width={6} height={4} rx={2} fill="#3a2010" />
      <rect x={x} y={ly + legR + 6} width={6} height={4} rx={2} fill="#3a2010" />
    </g>
  )
}

// ─── Характеристики персонажа ──────────────────────────────────────────────────

interface CharState {
  x: number
  dir: 1 | -1
  anim: CharAnim
  frame: number
  targetX: number
  stateTimer: number
}

// ─── Модальное окно оборудования ──────────────────────────────────────────────

function EquipModal({
  type, item, def, userLevel, coins,
  onClose, onBuy, onUpgrade, loading
}: {
  type: string
  item: EquipmentItem | undefined
  def: EquipDef
  userLevel: number
  coins: number
  onClose: () => void
  onBuy: () => void
  onUpgrade: () => void
  loading: boolean
}) {
  const owned = !!item
  const level = item?.level ?? 0
  const canBuy = !owned && userLevel >= def.unlockLevel && coins >= def.buyPrice
  const canUpgrade = owned && item.canUpgrade &&
    userLevel >= (item.upgradeLevelReq ?? 0) && coins >= (item.upgradePrice ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-brown-900 border-t border-brown-700 rounded-t-2xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-cream-100 font-bold text-lg">{def.name}</h3>
            {owned && (
              <p className="text-amber-400 text-xs mt-0.5">
                Уровень {level} / {def.maxLevel}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-cream-200 text-2xl active:opacity-60">×</button>
        </div>

        {/* Текущее состояние */}
        {owned ? (
          <div className="bg-brown-800 rounded-xl p-3 space-y-1">
            <p className="text-cream-100 text-sm font-semibold">{def.descriptions[level - 1]}</p>
            <p className="text-hop-400 text-xs">✨ {def.bonuses[level - 1]}</p>
          </div>
        ) : (
          <div className="bg-brown-800 rounded-xl p-3">
            <p className="text-cream-200 text-sm">{def.descriptions[0]}</p>
            <p className="text-hop-400 text-xs mt-1">✨ {def.bonuses[0]}</p>
          </div>
        )}

        {/* Следующий уровень */}
        {owned && item.canUpgrade && (
          <div className="bg-brown-800 rounded-xl p-3 border border-amber-600/30 space-y-1">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">⬆️ Улучшение до ур.{level + 1}</p>
            <p className="text-cream-100 text-sm">{def.descriptions[level]}</p>
            <p className="text-hop-400 text-xs">✨ {def.bonuses[level]}</p>
          </div>
        )}

        {/* Кнопки */}
        {!owned ? (
          <>
            {userLevel < def.unlockLevel ? (
              <div className="bg-brown-800 rounded-xl p-3 text-center">
                <p className="text-cream-200 text-sm">🔒 Требуется уровень {def.unlockLevel}</p>
                <p className="text-cream-200 text-xs opacity-50 mt-1">Ваш уровень: {userLevel}</p>
              </div>
            ) : (
              <button
                disabled={!canBuy || loading}
                onClick={onBuy}
                className={`w-full py-3 rounded-xl font-bold text-base transition-opacity ${
                  canBuy ? 'bg-amber-600 text-brown-950 active:opacity-80' : 'bg-brown-700 text-cream-200 opacity-50'
                }`}
              >
                {loading ? '...' : `Купить за ${def.buyPrice} 🪙`}
              </button>
            )}
          </>
        ) : item.canUpgrade ? (
          <>
            {(item.upgradeLevelReq ?? 0) > userLevel ? (
              <div className="bg-brown-800 rounded-xl p-3 text-center">
                <p className="text-cream-200 text-sm">🔒 Для улучшения нужен ур.{item.upgradeLevelReq}</p>
              </div>
            ) : (
              <button
                disabled={!canUpgrade || loading}
                onClick={onUpgrade}
                className={`w-full py-3 rounded-xl font-bold text-base transition-opacity ${
                  canUpgrade ? 'bg-hop-600 text-cream-100 active:opacity-80' : 'bg-brown-700 text-cream-200 opacity-50'
                }`}
              >
                {loading ? '...' : `Улучшить за ${item.upgradePrice} 🪙`}
              </button>
            )}
          </>
        ) : (
          <div className="bg-hop-900/30 border border-hop-700 rounded-xl p-3 text-center">
            <p className="text-hop-400 text-sm font-semibold">✅ Максимальный уровень</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Главный компонент BreweryScene ───────────────────────────────────────────

interface BrewerySceneProps {
  userLevel: number
  coins: number
  onCoinsChange: (delta: number) => void
}

export function BreweryScene({ userLevel, coins, onCoinsChange }: BrewerySceneProps) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [batches,   setBatches]   = useState<Batch[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const charRef = useRef<CharState>({
    x: 180, dir: 1, anim: 'sweep', frame: 0,
    targetX: 180, stateTimer: 60,
  })
  const [charSnapshot, setCharSnapshot] = useState<CharState>({ ...charRef.current })

  // Загружаем данные
  const load = useCallback(async () => {
    try {
      const [eq, bt] = await Promise.all([api.getEquipment(), api.getBatches()])
      setEquipment(eq.items)
      setBatches(bt.items)
    } catch (_) {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Определяем активный статус варки
  const activeBatch = batches.find(b => ['mashing', 'boiling', 'fermenting', 'conditioning'].includes(b.status))
  const isBoiling   = activeBatch?.status === 'mashing' || activeBatch?.status === 'boiling'
  const isFermenting = activeBatch?.status === 'fermenting'
  const isReady     = batches.some(b => b.status === 'ready')

  // Выбираем цель для персонажа в зависимости от активности
  const getTargetX = useCallback((): number => {
    if (isBoiling)    return 48   // к котлу
    if (isFermenting) return 128  // к ферментеру
    if (isReady)      return 180  // в центр (радуется)
    return -1 // случайный
  }, [isBoiling, isFermenting, isReady])

  // Игровой цикл персонажа
  useEffect(() => {
    const SCENE_MIN = 20
    const SCENE_MAX = 340
    const WALK_SPEED = 0.9

    const interval = setInterval(() => {
      const c = charRef.current
      let { x, dir, anim, frame, targetX, stateTimer } = c

      // Обновляем кадр анимации
      frame = frame === 0 ? 1 : 0

      stateTimer--

      if (stateTimer <= 0) {
        // Выбираем новое действие
        const forced = getTargetX()
        if (forced >= 0) {
          targetX = forced
          anim = forced === 48 ? 'stir' : forced === 128 ? 'check' : 'excited'
          stateTimer = 80
        } else {
          const r = Math.random()
          if (r < 0.4) {
            // Идём куда-то
            targetX = SCENE_MIN + Math.random() * (SCENE_MAX - SCENE_MIN)
            anim = 'walk'
            stateTimer = 50 + Math.random() * 80
          } else if (r < 0.7) {
            // Метём
            anim = 'sweep'
            stateTimer = 40 + Math.random() * 40
          } else {
            // Стоим
            anim = 'idle'
            stateTimer = 20 + Math.random() * 30
          }
        }
      }

      // Двигаемся к цели
      if (anim === 'walk' || (getTargetX() >= 0 && Math.abs(x - targetX) > 4)) {
        const effectiveTarget = getTargetX() >= 0 ? getTargetX() : targetX
        if (Math.abs(x - effectiveTarget) > 2) {
          const dx = effectiveTarget > x ? WALK_SPEED : -WALK_SPEED
          x = Math.max(SCENE_MIN, Math.min(SCENE_MAX, x + dx))
          dir = dx > 0 ? 1 : -1
          if (anim !== 'walk') anim = 'walk'
        } else {
          x = effectiveTarget
          // Достигли цели — переключаемся на рабочую анимацию
          const forced = getTargetX()
          if (forced >= 0) {
            anim = forced === 48 ? 'stir' : forced === 128 ? 'check' : 'excited'
          } else {
            anim = 'sweep'
          }
        }
      }

      charRef.current = { x, dir, anim, frame, targetX, stateTimer }
      setCharSnapshot({ x, dir, anim, frame, targetX, stateTimer })
    }, 80)

    return () => clearInterval(interval)
  }, [getTargetX])

  // Обработчики
  const handleBuy = async (type: string) => {
    setActionLoading(true)
    try {
      await api.buyEquipment(type)
      onCoinsChange(-(EQUIP_DEFS[type]?.buyPrice ?? 0))
      await load()
    } catch (_) {
      // TODO: toast
    } finally {
      setActionLoading(false)
      setSelected(null)
    }
  }

  const handleUpgrade = async (type: string) => {
    const item = equipment.find(e => e.type === type)
    if (!item) return
    setActionLoading(true)
    try {
      await api.upgradeEquipment(type)
      onCoinsChange(-(item.upgradePrice ?? 0))
      await load()
    } catch (_) {
      // TODO: toast
    } finally {
      setActionLoading(false)
      setSelected(null)
    }
  }

  // Рендер SVG оборудования
  function renderEquip(type: string) {
    const def = EQUIP_DEFS[type]
    if (!def) return null
    const { sceneX: cx } = def
    const item = equipment.find(e => e.type === type)

    if (!item) {
      if (userLevel < def.unlockLevel) {
        return <LockedEquipSVG key={type} cx={cx} name={def.name} level={def.unlockLevel} buyPrice={def.buyPrice} />
      }
      return <BuyEquipSVG key={type} cx={cx} name={def.name} buyPrice={def.buyPrice} onClick={() => setSelected(type)} />
    }

    const onClick = () => setSelected(type)
    const isActiveKettle = (type === 'kettle') && isBoiling
    const isActiveFerm   = (type === 'fermenter') && isFermenting

    switch (type) {
      case 'kettle':
        return <g key={type} onClick={onClick} style={{ cursor: 'pointer' }}><KettleSVG cx={cx} level={item.level} isActive={isActiveKettle} /></g>
      case 'fermenter':
        return <g key={type} onClick={onClick} style={{ cursor: 'pointer' }}><FermenterSVG cx={cx} level={item.level} isActive={isActiveFerm} /></g>
      case 'mash_tun':
        return <g key={type} onClick={onClick} style={{ cursor: 'pointer' }}><MashTunSVG cx={cx} level={item.level} /></g>
      case 'hop_back':
        return <g key={type} onClick={onClick} style={{ cursor: 'pointer' }}><HopBackSVG cx={cx} level={item.level} /></g>
      case 'conditioning_tank':
        return <g key={type} onClick={onClick} style={{ cursor: 'pointer' }}><CondTankSVG cx={cx} level={item.level} /></g>
      default: return null
    }
  }

  const selectedDef  = selected ? EQUIP_DEFS[selected] : null
  const selectedItem = selected ? equipment.find(e => e.type === selected) : undefined

  return (
    <div className="relative">
      {/* Статус-строка */}
      <div className="flex items-center justify-between px-4 py-2 bg-brown-900/60">
        <p className="text-cream-200 text-xs">
          {isBoiling ? '🔥 Идёт варка...'
           : isFermenting ? '🧪 Брожение...'
           : isReady ? '🍺 Пиво готово!'
           : '😴 Пивоварня отдыхает'}
        </p>
        <p className="text-amber-400 text-xs font-bold">{coins.toLocaleString('ru')} 🪙</p>
      </div>

      {/* Сцена */}
      <div className="w-full overflow-hidden">
        {loading ? (
          <div className="h-56 flex items-center justify-center">
            <div className="text-cream-200 text-sm animate-pulse">Загрузка пивоварни...</div>
          </div>
        ) : (
          <svg
            viewBox="0 0 370 230"
            className="w-full"
            style={{ maxHeight: '260px', display: 'block' }}
          >
            {/* Задний фон — каменная стена */}
            <defs>
              <pattern id="brickPat" x="0" y="0" width="40" height="18" patternUnits="userSpaceOnUse">
                <rect width="40" height="18" fill="#2a1a0a" />
                <rect x="0"  y="0" width="18" height="8" rx="1" fill="#331a08" stroke="#1a0e04" strokeWidth="0.5" />
                <rect x="20" y="0" width="18" height="8" rx="1" fill="#3a1e0a" stroke="#1a0e04" strokeWidth="0.5" />
                <rect x="10" y="10" width="18" height="8" rx="1" fill="#331a08" stroke="#1a0e04" strokeWidth="0.5" />
                <rect x="30" y="10" width="10" height="8" rx="1" fill="#3a1e0a" stroke="#1a0e04" strokeWidth="0.5" />
                <rect x="0"  y="10" width="8"  height="8" rx="1" fill="#3a1e0a" stroke="#1a0e04" strokeWidth="0.5" />
              </pattern>
              <pattern id="woodPat" x="0" y="0" width="40" height="10" patternUnits="userSpaceOnUse">
                <rect width="40" height="10" fill="#4a2c10" />
                <rect y="0" width="40" height="4" fill="#5a3618" />
                <rect y="5" width="40" height="4" fill="#523010" />
                <line x1="0" y1="2" x2="40" y2="2" stroke="#6a4020" strokeWidth="0.3" opacity="0.5" />
              </pattern>
            </defs>

            {/* Стена */}
            <rect x="0" y="0" width="370" height="196" fill="url(#brickPat)" />

            {/* Затемнение вверху */}
            <rect x="0" y="0" width="370" height="60" fill="url(#fadeTop)" opacity="0.3" />

            {/* Полки */}
            <rect x="10"  y="60" width="80" height="6"  rx="2" fill="#5a3010" />
            <rect x="9"   y="60" width="82" height="4"  rx="2" fill="#6a4020" />
            <rect x="280" y="55" width="80" height="6"  rx="2" fill="#5a3010" />
            <rect x="279" y="55" width="82" height="4"  rx="2" fill="#6a4020" />

            {/* Декор на полках */}
            <circle cx="30"  cy="52" r="8" fill="#8b6914" />
            <circle cx="30"  cy="52" r="6" fill="#7a5810" />
            <text x="30" y="56" textAnchor="middle" fontSize="8">🍺</text>
            <circle cx="55"  cy="52" r="7" fill="#6a4010" />
            <text x="55" y="56" textAnchor="middle" fontSize="8">🌾</text>
            <circle cx="78"  cy="52" r="6" fill="#4a6010" />
            <text x="78" y="56" textAnchor="middle" fontSize="8">🌿</text>
            <text x="300" y="50" textAnchor="middle" fontSize="9">🧪</text>
            <text x="320" y="50" textAnchor="middle" fontSize="9">⚗️</text>
            <text x="340" y="50" textAnchor="middle" fontSize="9">🏆</text>

            {/* Окно */}
            <rect x="160" y="25" width="50" height="36" rx="4" fill="#1a3050" stroke="#8b6914" strokeWidth="2" />
            <rect x="161" y="26" width="23" height="34" fill="#1a3a60" />
            <rect x="186" y="26" width="23" height="34" fill="#1a4070" />
            <line x1="184" y1="26" x2="184" y2="60" stroke="#8b6914" strokeWidth="1.5" />
            <line x1="161" y1="43" x2="209" y2="43" stroke="#8b6914" strokeWidth="1.5" />
            {/* Свет из окна */}
            <polygon points="161,60 209,60 230,100 140,100" fill="#d4a01710" />

            {/* Пол */}
            <rect x="0" y="196" width="370" height="34" fill="url(#woodPat)" />
            {/* Плинтус */}
            <rect x="0" y="196" width="370" height="4" fill="#6a4020" />

            {/* Оборудование */}
            {EQUIP_ORDER.map(type => renderEquip(type))}

            {/* Персонаж */}
            <CharacterSVG
              x={charSnapshot.x}
              dir={charSnapshot.dir}
              anim={charSnapshot.anim}
              frame={charSnapshot.frame}
            />

            {/* Тень персонажа */}
            <ellipse
              cx={charSnapshot.x}
              cy={197}
              rx={10}
              ry={3}
              fill="black"
              opacity={0.25}
            />

            {/* Подсказка "нажми на оборудование" */}
            <text x="185" y="222" textAnchor="middle" fontSize="8" fill="#a08060" opacity={0.6}>
              Нажми на оборудование для просмотра и улучшения
            </text>
          </svg>
        )}
      </div>

      {/* Список установленного оборудования */}
      {!loading && equipment.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          <p className="text-cream-200 text-xs font-semibold uppercase tracking-wide opacity-60">Оборудование</p>
          <div className="grid grid-cols-2 gap-2">
            {equipment.map(item => {
              const def = EQUIP_DEFS[item.type]
              return (
                <button
                  key={item.type}
                  onClick={() => setSelected(item.type)}
                  className="bg-brown-900 border border-brown-800 rounded-xl px-3 py-2.5 text-left active:opacity-80 active:border-amber-700"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-cream-100 text-xs font-bold truncate">{def?.name ?? item.name}</p>
                    <span className="text-amber-400 text-xs font-bold ml-1">Ур.{item.level}</span>
                  </div>
                  <p className="text-hop-400 text-xs opacity-80">{item.bonus}</p>
                  {item.canUpgrade && (
                    <p className="text-amber-500 text-xs mt-1">⬆️ {item.upgradePrice}🪙</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Модальное окно */}
      {selected && selectedDef && (
        <EquipModal
          type={selected}
          item={selectedItem}
          def={selectedDef}
          userLevel={userLevel}
          coins={coins}
          onClose={() => setSelected(null)}
          onBuy={() => handleBuy(selected)}
          onUpgrade={() => handleUpgrade(selected)}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
