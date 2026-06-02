// Клиентские расчёты для предпросмотра (B.1–B.5)
// Финальный расчёт при варке — ТОЛЬКО на сервере.

// ── Константы (зеркало game-config.ts) ────────────────────────────────────────

const MASH_EFF_DEFAULT = 0.80

const MASH_TEMP_FACTOR: Record<string, number> = {
  '63': 1.05, '64': 1.05,
  '65': 1.00, '66': 1.00, '67': 1.00,
  '68': 0.93, '69': 0.93, '70': 0.93,
}

const HOP_UTILIZATION: Record<HopTiming, number> = {
  bittering: 0.21,
  flavor:    0.12,
  aroma:     0.05,
  dry_hop:   0.00,
}

const SRM_K   = 5.0
const SRM_EXP = 0.69
const ABV_FACTOR = 131.25

// ── Типы ──────────────────────────────────────────────────────────────────────

export type HopTiming = 'bittering' | 'flavor' | 'aroma' | 'dry_hop'

export interface MaltEntry {
  key: string
  name: string
  ppkg: number     // gravity points per kg·L
  colorL: number   // °Lovibond
  amountKg: number
}

export interface HopEntry {
  key: string
  name: string
  alphaFraction: number  // доля: 0.12 = 12%
  amountG: number
  timing: HopTiming
}

export interface RecipeInput {
  malts:        MaltEntry[]
  hops:         HopEntry[]
  yeastAttenuation: number   // доля: 0.75
  mashTempC:    number       // °C
  volumeL:      number       // литры
  mashEff?:     number       // 0–1, дефолт 0.80
}

export interface BrewPreview {
  og:  number   // 1.062
  fg:  number   // 1.014
  abv: number   // %
  ibu: number
  srm: number
  gp:  number   // gravity points (OG-1)*1000
  bugu: number  // IBU / GP
}

// ── B.1 OG ────────────────────────────────────────────────────────────────────

function calcOG(malts: MaltEntry[], volumeL: number, mashEff: number) {
  const totalGP = malts.reduce((sum, m) => sum + m.amountKg * m.ppkg, 0)
  const gp = (totalGP * mashEff) / volumeL
  return { gp, og: 1 + gp / 1000 }
}

// ── B.2 FG ────────────────────────────────────────────────────────────────────

function calcFG(og: number, attenuation: number, mashTempC: number) {
  const tempKey = String(Math.round(mashTempC))
  const mashTempFactor = MASH_TEMP_FACTOR[tempKey] ?? 1.0
  // При предпросмотре acc_mash = 1.0 (идеальный)
  const effAtt = Math.min(Math.max(attenuation * mashTempFactor * (0.97 + 0.03), 0.50), 0.92)
  return 1 + (og - 1) * (1 - effAtt)
}

// ── B.3 ABV ───────────────────────────────────────────────────────────────────

function calcABV(og: number, fg: number) {
  return (og - fg) * ABV_FACTOR
}

// ── B.4 IBU ───────────────────────────────────────────────────────────────────

function calcIBU(hops: HopEntry[], og: number, volumeL: number) {
  // Tinseth bigness factor
  const gravityFactor = 1.65 * Math.pow(0.000125, og - 1)

  return hops.reduce((sum, hop) => {
    const u = HOP_UTILIZATION[hop.timing]
    const mgL = (hop.amountG * hop.alphaFraction * 1000) / volumeL
    // acc_hops = 1.0 при предпросмотре
    return sum + u * gravityFactor * mgL
  }, 0)
}

// ── B.5 SRM ───────────────────────────────────────────────────────────────────

function calcSRM(malts: MaltEntry[], volumeL: number) {
  const mcu = malts.reduce((sum, m) => sum + m.colorL * m.amountKg, 0) / volumeL
  if (mcu <= 0) return 0
  return SRM_K * Math.pow(mcu, SRM_EXP)
}

// ── SRM → hex цвет для визуализации ──────────────────────────────────────────

export function srmToHex(srm: number): string {
  if (srm <= 3)  return '#F8E08E'
  if (srm <= 6)  return '#F0C24B'
  if (srm <= 10) return '#D98C28'
  if (srm <= 17) return '#A85419'
  if (srm <= 25) return '#5A2D10'
  return '#1F0E07'
}

// ── Главная функция ───────────────────────────────────────────────────────────

export function calculatePreview(recipe: RecipeInput): BrewPreview {
  const mashEff = recipe.mashEff ?? MASH_EFF_DEFAULT
  const volumeL = recipe.volumeL > 0 ? recipe.volumeL : 20

  const { gp, og } = calcOG(recipe.malts, volumeL, mashEff)
  const fg  = recipe.malts.length > 0
    ? calcFG(og, recipe.yeastAttenuation, recipe.mashTempC)
    : 1.000
  const abv = calcABV(og, fg)
  const ibu = calcIBU(recipe.hops, og, volumeL)
  const srm = calcSRM(recipe.malts, volumeL)
  const bugu = gp > 0 ? ibu / gp : 0

  return {
    og:  Math.round(og * 1000) / 1000,
    fg:  Math.round(fg * 1000) / 1000,
    abv: Math.round(abv * 10) / 10,
    ibu: Math.round(ibu),
    srm: Math.round(srm * 10) / 10,
    gp:  Math.round(gp * 10) / 10,
    bugu: Math.round(bugu * 100) / 100,
  }
}

// ── StyleMatch для подсветки параметров ──────────────────────────────────────

export interface StyleRange {
  og?:  [number, number]
  fg?:  [number, number]
  abv?: [number, number]
  ibu?: [number, number]
  srm?: [number, number]
}

export type ParamStatus = 'ok' | 'low' | 'high' | 'unknown'

export function getParamStatus(
  value: number,
  range: [number, number] | undefined,
): ParamStatus {
  if (!range) return 'unknown'
  if (value < range[0]) return 'low'
  if (value > range[1]) return 'high'
  return 'ok'
}
