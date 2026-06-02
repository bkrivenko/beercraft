/**
 * Прогрессия игрока — B.12, D.3, D.4
 * Все пороги и разблокировки в одном месте.
 */

import { GAME_CONFIG } from '../config/game-config.js'

// ── XP до следующего уровня (B.12) ────────────────────────────────────────────

export function xpToNextLevel(level: number): number {
  return GAME_CONFIG.xp.toLevel(level + 1)
}

/** Суммарный XP нужный чтобы достичь уровня L (накопленный) */
export function totalXpForLevel(level: number): number {
  let total = 0
  for (let l = 1; l < level; l++) total += GAME_CONFIG.xp.toLevel(l)
  return total
}

/** XP для перехода level → level+1 */
export function xpForLevelUp(level: number): number {
  return GAME_CONFIG.xp.toLevel(level)
}

// ── Таблица разблокировок D.4 ─────────────────────────────────────────────────

export interface LevelUnlocks {
  level:       number
  styles:      string[]           // ключи beer_styles
  ingredients: string[]           // ключи ingredients
  equipment:   string[]           // описание (display)
  startingSoftCurrency?: number   // бонусные монеты при разблокировке
}

export const LEVEL_UNLOCKS: LevelUnlocks[] = [
  {
    level: 1,
    styles:      ['pale_ale'],
    ingredients: ['pale_2row','crystal40','magnum','cascade','us05','hoppy','balanced'],
    equipment:   ['Котёл 20 л','2 ферментера'],
    startingSoftCurrency: 500,
  },
  {
    level: 2,
    styles:      ['hefeweizen'],
    ingredients: ['pilsner','wheat','hallertau','wb06','soft'],
    equipment:   ['Ферментер слот №3 (доступен в магазине)'],
  },
  {
    level: 3,
    styles:      ['pilsner'],
    ingredients: ['saaz','s23'],
    equipment:   ['Котёл 40 л','Контроль температуры'],
  },
  {
    level: 4,
    styles:      ['ipa'],
    ingredients: ['centennial','citra'],
    equipment:   ['Ферментер слот №4'],
  },
  {
    level: 5,
    styles:      ['brown'],
    ingredients: ['munich','crystal80','notty'],
    equipment:   ['Гликолевый контроль','Линия розлива'],
  },
  {
    level: 6,
    styles:      ['porter'],
    ingredients: ['chocolate','malty'],
    equipment:   ['Котёл 80 л','Ферментер слот №5'],
  },
  {
    level: 7,
    styles:      ['stout','dry_stout'],
    ingredients: ['roasted','irish_ale','carbonate'],
    equipment:   ['Холодный склад / выдержка'],
  },
  {
    level: 8,
    styles:      ['marzen'],
    ingredients: ['vienna'],
    equipment:   ['Лаборатория QA'],
  },
  {
    level: 9,
    styles:      ['witbier'],
    ingredients: ['flaked_oats'],
    equipment:   [],
  },
  {
    level: 10,
    styles:      ['saison'],
    ingredients: [],
    equipment:   [],
  },
  {
    level: 11,
    styles:      ['neipa'],
    ingredients: ['mosaic','simcoe'],
    equipment:   [],
  },
  {
    level: 12,
    styles:      [],
    ingredients: [],
    equipment:   [],
  },
]

export function getUnlocksForLevel(level: number): LevelUnlocks | undefined {
  return LEVEL_UNLOCKS.find((u) => u.level === level)
}

// ── Основная функция: начислить XP + левел-апы ────────────────────────────────

export interface XpGainResult {
  xpGained:     number
  newXp:        number
  newLevel:     number
  leveledUp:    boolean
  levelsGained: number
  unlocks:      LevelUnlocks[]   // что разблокировалось
  xpToNext:     number           // сколько до следующего уровня
  xpProgress:   number           // 0–1 прогресс в текущем уровне
}

export function computeXpGain(
  currentXp: number,
  currentLevel: number,
  xpGain: number,
): XpGainResult {
  let xp    = currentXp + xpGain
  let level = currentLevel
  const unlocks: LevelUnlocks[] = []

  // Прокручиваем левел-апы
  while (true) {
    const needed = xpForLevelUp(level)
    if (xp < needed) break

    xp -= needed
    level++

    const u = getUnlocksForLevel(level)
    if (u) unlocks.push(u)

    if (level >= 12) break  // cap
  }

  const needed     = xpForLevelUp(level)
  const xpProgress = Math.min(xp / needed, 1)

  return {
    xpGained:    xpGain,
    newXp:       xp,
    newLevel:    level,
    leveledUp:   level > currentLevel,
    levelsGained: level - currentLevel,
    unlocks,
    xpToNext:    needed,
    xpProgress,
  }
}

// ── Сводка профиля прогрессии ────────────────────────────────────────────────

export interface ProgressionSummary {
  level:       number
  xp:          number
  xpToNext:    number
  xpProgress:  number   // 0–1
  nextUnlocks: LevelUnlocks | undefined
}

export function getProgressionSummary(level: number, xp: number): ProgressionSummary {
  const needed     = xpForLevelUp(level)
  const xpProgress = Math.min(xp / needed, 1)

  return {
    level,
    xp,
    xpToNext:    needed,
    xpProgress,
    nextUnlocks: getUnlocksForLevel(level + 1),
  }
}
