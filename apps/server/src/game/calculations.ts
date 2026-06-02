/**
 * Серверные расчёты BeerCraft — Formuly_Balansa_BeerCraft.md §B.1–B.10
 *
 * Все коэффициенты — из src/config/game-config.ts.
 * Эти функции — единственный источник истины для параметров пива.
 * Клиентский preview (brewCalc.ts) использует упрощения; финальный результат
 * партии считается только здесь.
 */

import { GAME_CONFIG } from '../config/game-config.js'

// ── Вспомогательные типы ──────────────────────────────────────────────────────

export type HopTiming = 'bittering' | 'flavor' | 'aroma' | 'dry_hop'

export interface MaltInput {
  ppkg:      number   // gravity points per kg·L (из справочника)
  colorL:    number   // °Lovibond
  amountKg:  number   // кг в рецепте
}

export interface HopInput {
  alphaFraction: number   // доля альфа-кислот, напр. 0.12 = 12%
  amountG:       number   // граммы
  timing:        HopTiming
}

export interface ProcessAccuracy {
  mash:    number   // 0–1
  hops:    number   // 0–1
  chill:   number   // 0–1
  ferment: number   // 0–1
}

export interface StyleRange {
  og?:        [number, number]
  fg?:        [number, number]
  abv?:       [number, number]
  ibu?:       [number, number]
  srm?:       [number, number]
  buguTarget?: [number, number]
  basePrice?: number
}

export interface BrewResult {
  og:           number
  fg:           number
  abv:          number
  ibu:          number
  srm:          number
  gp:           number
  bugu:         number
  styleMatch:   number   // 0–100
  processAccuracy: number  // 0–1
  balanceScore: number   // 0–100
  quality:      number   // 0–100
}

// ── Утилиты ───────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round3(n: number): number { return Math.round(n * 1000) / 1000 }
function round1(n: number): number { return Math.round(n * 10) / 10 }
function round0(n: number): number { return Math.round(n) }

/** Возвращает mashTempFactor для заданной температуры затирания */
function getMashTempFactor(tempC: number): number {
  for (const range of GAME_CONFIG.mash.tempFactor) {
    if (tempC >= range.min && tempC <= range.max) return range.factor
  }
  return GAME_CONFIG.mash.tempFactorDefault
}

// ── B.1 Начальная плотность (OG) ──────────────────────────────────────────────

/**
 * GP = (Σ amountKg_i × ppkg_i) × mashEff / volumeL
 * OG = 1 + GP / 1000
 */
export function calcOG(
  malts: MaltInput[],
  volumeL: number,
  mashEff: number = GAME_CONFIG.mash.effDefault,
): { og: number; gp: number } {
  if (malts.length === 0 || volumeL <= 0) return { og: 1.000, gp: 0 }

  const totalGP = malts.reduce((sum, m) => sum + m.amountKg * m.ppkg, 0)
  const gp = (totalGP * mashEff) / volumeL
  const og = round3(1 + gp / 1000)

  return { og, gp: round1(gp) }
}

// ── B.2 Конечная плотность (FG) ───────────────────────────────────────────────

/**
 * effAtt = clamp(attenuation × mashTempFactor × (0.97 + 0.03 × Acc_mash), 0.50, 0.92)
 * FG = 1 + (OG − 1) × (1 − effAtt)
 */
export function calcFG(
  og: number,
  attenuation: number,
  mashTempC: number,
  accMash: number = 1.0,
): number {
  const mashTempFactor = getMashTempFactor(mashTempC)
  const effAtt = clamp(
    attenuation * mashTempFactor * (0.97 + 0.03 * accMash),
    GAME_CONFIG.mash.effAttMin,
    GAME_CONFIG.mash.effAttMax,
  )
  return round3(1 + (og - 1) * (1 - effAtt))
}

// ── B.3 Крепость (ABV) ────────────────────────────────────────────────────────

/**
 * ABV(%) = (OG − FG) × 131.25
 */
export function calcABV(og: number, fg: number): number {
  return round1((og - fg) * GAME_CONFIG.brew.abvFactor)
}

// ── B.4 Горечь (IBU) ──────────────────────────────────────────────────────────

/**
 * gravityFactor = 1.65 × 0.000125^(OG−1)   (Tinseth bigness)
 * mgL_i = amountG_i × alpha_i × 1000 / V
 * IBU_i = U_i × gravityFactor × mgL_i × Acc_hops_i
 * IBU   = Σ IBU_i
 */
export function calcIBU(
  hops: HopInput[],
  og: number,
  volumeL: number,
  accHops: number = 1.0,
): number {
  if (hops.length === 0 || volumeL <= 0) return 0

  const { tinsethA, tinsethB, utilization } = GAME_CONFIG.hops
  const gravityFactor = tinsethA * Math.pow(tinsethB, og - 1)

  const total = hops.reduce((sum, hop) => {
    const u = utilization[hop.timing] ?? 0
    if (u === 0) return sum   // dry hop — IBU = 0
    const mgL = (hop.amountG * hop.alphaFraction * 1000) / volumeL
    return sum + u * gravityFactor * mgL * accHops
  }, 0)

  return round0(total)
}

// ── B.5 Цвет (SRM) ────────────────────────────────────────────────────────────

/**
 * MCU = (Σ colorL_i × amountKg_i) / V
 * SRM = srm_k × MCU^0.69
 */
export function calcSRM(malts: MaltInput[], volumeL: number): number {
  if (malts.length === 0 || volumeL <= 0) return 0

  const mcu = malts.reduce((sum, m) => sum + m.colorL * m.amountKg, 0) / volumeL
  if (mcu <= 0) return 0

  const { srmK, srmExp } = GAME_CONFIG.brew
  return round1(srmK * Math.pow(mcu, srmExp))
}

// ── B.7 Точность процесса ─────────────────────────────────────────────────────

/**
 * processAccuracy = w_m·Acc_mash + w_h·Acc_hops + w_c·Acc_chill + w_f·Acc_ferm
 * penalty_offflavor = k_off × ((1−Acc_chill) + (1−Acc_ferm))
 */
export function calcProcessAccuracy(acc: ProcessAccuracy): {
  processAccuracy: number
  penaltyOffflavor: number
} {
  const { weights } = GAME_CONFIG.process
  const processAccuracy = clamp(
    weights.mash    * acc.mash    +
    weights.hops    * acc.hops    +
    weights.chill   * acc.chill   +
    weights.ferment * acc.ferment,
    0, 1,
  )
  const penaltyOffflavor = GAME_CONFIG.quality.kOff * ((1 - acc.chill) + (1 - acc.ferment))
  return { processAccuracy, penaltyOffflavor }
}

// ── B.8 Соответствие стилю (styleMatch, 0–100) ────────────────────────────────

/**
 * Для каждого параметра p:
 *   если в диапазоне: score_p = 100 − bonusCenter × |value − mid| / halfRange
 *   если вне диапазона: score_p = max(0, 100 − kOut × dist / rangeWidth)
 * styleMatch = Σ(weight_p × score_p) / Σ weight_p
 */
export function calcStyleMatch(
  params: { og: number; fg: number; abv: number; ibu: number; srm: number },
  styleRange: StyleRange,
): number {
  const { paramWeights, kOut, bonusCenter } = GAME_CONFIG.styleMatch

  function scoreParam(value: number, range: [number, number] | undefined): number | null {
    if (!range) return null
    const [lo, hi] = range
    const mid = (lo + hi) / 2
    const halfRange = (hi - lo) / 2
    const rangeWidth = hi - lo

    if (rangeWidth <= 0) return value === lo ? 100 : 0

    if (value >= lo && value <= hi) {
      // В диапазоне: небольшой штраф за отклонение от центра
      return clamp(100 - bonusCenter * Math.abs(value - mid) / halfRange, 0, 100)
    } else {
      // Вне диапазона: штраф пропорционален расстоянию
      const dist = value < lo ? lo - value : value - hi
      return clamp(100 - kOut * dist / rangeWidth, 0, 100)
    }
  }

  const scored: Array<{ score: number; weight: number }> = []

  const checks: Array<{ value: number; range: [number, number] | undefined; weight: number }> = [
    { value: params.abv, range: styleRange.abv, weight: paramWeights.abv },
    { value: params.ibu, range: styleRange.ibu, weight: paramWeights.ibu },
    { value: params.srm, range: styleRange.srm, weight: paramWeights.srm },
    { value: params.fg,  range: styleRange.fg,  weight: paramWeights.fg  },
  ]

  for (const { value, range, weight } of checks) {
    const score = scoreParam(value, range)
    if (score !== null) scored.push({ score, weight })
  }

  if (scored.length === 0) return 0

  const totalWeight = scored.reduce((s, x) => s + x.weight, 0)
  const weightedSum = scored.reduce((s, x) => s + x.score * x.weight, 0)

  return round0(weightedSum / totalWeight)
}

// ── B.9 Баланс BU:GU ─────────────────────────────────────────────────────────

/**
 * BUGU = IBU / GP
 * balanceScore = clamp(100 − k_bal × |BUGU − BUGU_target_mid|, 0, 100)
 */
export function calcBalanceScore(ibu: number, gp: number, buguTarget?: [number, number]): number {
  if (gp <= 0) return 0
  if (!buguTarget) return 100   // без целевого стиля — штрафа нет

  const bugu = ibu / gp
  const targetMid = (buguTarget[0] + buguTarget[1]) / 2
  return clamp(100 - GAME_CONFIG.balance.kBal * Math.abs(bugu - targetMid), 0, 100)
}

// ── B.10 Итоговое качество (0–100) ───────────────────────────────────────────

/**
 * Quality = clamp(
 *   w1 × styleMatch + w2 × (processAccuracy × 100) + w3 × balanceScore
 *   + bonus_water − penalty_offflavor + random
 * , 0, 100)
 */
export function calcQuality(params: {
  styleMatch:      number   // 0–100
  processAccuracy: number   // 0–1
  balanceScore:    number   // 0–100
  penaltyOffflavor: number
  bonusWater:      boolean  // профиль воды совпадает со стилем
  equipmentQuality?: number // 0–1, влияет на разброс удачи
}): number {
  const { weights, bonusWater, randomR0 } = GAME_CONFIG.quality

  const base =
    weights.styleMatch * params.styleMatch +
    weights.process    * (params.processAccuracy * 100) +
    weights.balance    * params.balanceScore

  const equipQ = params.equipmentQuality ?? 0
  const R = randomR0 * (1 - equipQ)
  const random = (Math.random() * 2 - 1) * R   // U(-R, +R)

  const bonus = params.bonusWater ? bonusWater : 0

  return clamp(
    round0(base + bonus - params.penaltyOffflavor + random),
    0, 100,
  )
}

// ── B.11 Цена продажи ────────────────────────────────────────────────────────

export function calcSellPrice(
  basePrice: number,
  quality: number,
  demandMult: number = 1.0,
  reputationMult: number = 1.0,
): number {
  const qualityMult = GAME_CONFIG.price.qualityMultMin + (quality / 100) * 1.5
  return round0(basePrice * qualityMult * demandMult * reputationMult)
}

// ── B.12 Опыт за варку ───────────────────────────────────────────────────────

export function calcBrewXP(quality: number, volumeL: number, isNewStyle: boolean): number {
  const { cQ, cV, newStyleBonus } = GAME_CONFIG.xp
  return round0(quality * cQ + volumeL * cV + (isNewStyle ? newStyleBonus : 0))
}

// ── Главная функция — полный расчёт партии ────────────────────────────────────

export interface FullBrewInput {
  malts:        MaltInput[]
  hops:         HopInput[]
  attenuation:  number       // из выбранных дрожжей
  mashTempC:    number
  volumeL:      number
  mashEff?:     number
  styleRange?:  StyleRange
  accuracy:     ProcessAccuracy
  bonusWater:   boolean
  equipmentQuality?: number
  isNewStyle?:  boolean
}

export function calcFullBrew(input: FullBrewInput): BrewResult & {
  sellPrice?: number
  brewXP: number
} {
  const { og, gp }    = calcOG(input.malts, input.volumeL, input.mashEff)
  const fg             = calcFG(og, input.attenuation, input.mashTempC, input.accuracy.mash)
  const abv            = calcABV(og, fg)
  const ibu            = calcIBU(input.hops, og, input.volumeL, input.accuracy.hops)
  const srm            = calcSRM(input.malts, input.volumeL)
  const bugu           = gp > 0 ? round3(ibu / gp) : 0

  const styleMatch     = input.styleRange
    ? calcStyleMatch({ og, fg, abv, ibu, srm }, input.styleRange)
    : 0

  const { processAccuracy, penaltyOffflavor } = calcProcessAccuracy(input.accuracy)

  const balanceScore   = calcBalanceScore(ibu, gp, input.styleRange?.buguTarget)

  const quality        = calcQuality({
    styleMatch,
    processAccuracy,
    balanceScore,
    penaltyOffflavor,
    bonusWater: input.bonusWater,
    equipmentQuality: input.equipmentQuality,
  })

  const sellPrice      = input.styleRange?.basePrice
    ? calcSellPrice(input.styleRange.basePrice, quality)
    : undefined

  const brewXP         = calcBrewXP(quality, input.volumeL, input.isNewStyle ?? false)

  return {
    og, fg, abv, ibu, srm, gp, bugu,
    styleMatch,
    processAccuracy,
    balanceScore,
    quality,
    sellPrice,
    brewXP,
  }
}
