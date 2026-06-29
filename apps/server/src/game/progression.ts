/**
 * Прогрессия игрока — B.12, D.3, D.4
 * Все пороги и разблокировки в одном месте.
 *
 * Правило: на каждый уровень ОДНА разблокировка — либо рецепт (доступен к покупке),
 * либо оборудование (доступно к покупке). Рецепты не выдаются автоматически.
 */

import { GAME_CONFIG } from '../config/game-config.js'

// ── XP до следующего уровня (B.12) ────────────────────────────────────────────

export function xpToNextLevel(level: number): number {
  return GAME_CONFIG.xp.toLevel(level + 1)
}

export function totalXpForLevel(level: number): number {
  let total = 0
  for (let l = 1; l < level; l++) total += GAME_CONFIG.xp.toLevel(l)
  return total
}

export function xpForLevelUp(level: number): number {
  return GAME_CONFIG.xp.toLevel(level)
}

// ── Таблица прогрессии ────────────────────────────────────────────────────────
// Каждый уровень — ровно 1 разблокировка.
// recipe_unlock  → рецепт становится доступен к покупке (или получить за заказ)
// equipment_key  → оборудование становится доступно к покупке в пивоварне
// ingredients    → ингредиенты открываются в магазине (без покупки рецепта)

export interface LevelUnlock {
  level:          number
  type:           'recipe' | 'equipment' | 'ingredients'
  // recipe
  recipe_key?:    string        // ключ стиля
  recipe_name?:   string        // читаемое название
  recipe_price?:  number        // цена покупки в монетах
  // equipment
  equipment_key?: string        // ключ оборудования
  equipment_name?:string
  // ingredients
  ingredients?:   string[]
}

export const LEVEL_UNLOCKS: LevelUnlock[] = [
  // Уровень 1 — стартовый рецепт даётся бесплатно в стартовом наборе
  // Уровень 2: первый покупной рецепт
  { level: 2,  type: 'recipe',      recipe_key: 'hefeweizen', recipe_name: 'Hefeweizen',    recipe_price: 150 },
  // Уровень 3: новый рецепт (элем тяжелее)
  { level: 3,  type: 'recipe',      recipe_key: 'ipa',        recipe_name: 'American IPA',  recipe_price: 300 },
  // Уровень 4: оборудование — заторный бак
  { level: 4,  type: 'equipment',   equipment_key: 'mash_tun',          equipment_name: 'Заторный бак' },
  // Уровень 5: тёмные эли
  { level: 5,  type: 'recipe',      recipe_key: 'porter',     recipe_name: 'Porter',        recipe_price: 350 },
  // Уровень 6: оборудование — хмелевой бак
  { level: 6,  type: 'equipment',   equipment_key: 'hop_back',          equipment_name: 'Хмелевой бак' },
  // Уровень 7: коричневый эль
  { level: 7,  type: 'recipe',      recipe_key: 'brown',      recipe_name: 'Brown Ale',     recipe_price: 250 },
  // Уровень 8: стаут
  { level: 8,  type: 'recipe',      recipe_key: 'stout',      recipe_name: 'Stout',         recipe_price: 450 },
  // Уровень 9: оборудование — чан выдержки
  { level: 9,  type: 'equipment',   equipment_key: 'conditioning_tank', equipment_name: 'Чан выдержки' },
  // Уровень 10: пшеничный
  { level: 10, type: 'recipe',      recipe_key: 'witbier',    recipe_name: 'Witbier',       recipe_price: 300 },
  // Уровень 11: сезонный
  { level: 11, type: 'recipe',      recipe_key: 'saison',     recipe_name: 'Saison',        recipe_price: 400 },
  // Уровень 12: NEIPA — топ
  { level: 12, type: 'recipe',      recipe_key: 'neipa',      recipe_name: 'NEIPA',         recipe_price: 600 },
  // Уровень 13: пилснер — классика с требованиями к качеству
  { level: 13, type: 'recipe',      recipe_key: 'pilsner',    recipe_name: 'Pilsner',       recipe_price: 500 },
]

// Ингредиенты открываются в магазине по уровню (без покупки рецепта)
// Это только для отображения «что откроется следующим»
export const INGREDIENT_UNLOCKS: Record<number, string[]> = {
  1:  ['pilsner', 'wb06', 'wheat_german', 'notty', 'hallertau', 'saaz'],
  2:  ['wheat', 'munich', 'soft', 'chocolate', 'crystal80', 'roasted', 'wlp001', 'citra', 'simcoe', 'centennial', 'columbus'],
  3:  ['flaked_oats', 's23', 'mosaic'],
  4:  ['wlp530'],
  5:  ['english_ale'],
  7:  ['irish_ale'],
  8:  ['vienna'],
  9:  ['belgian_wit'],
  10: ['belgian_saison'],
  12: ['belgian_abbey'],
}

export function getUnlockForLevel(level: number): LevelUnlock | undefined {
  return LEVEL_UNLOCKS.find(u => u.level === level)
}

// Для обратной совместимости с getUnlocksForLevel (me.ts, me/stats)
export function getUnlocksForLevel(level: number) {
  const u = getUnlockForLevel(level)
  if (!u) return undefined
  return {
    level,
    styles:      u.type === 'recipe'    ? [u.recipe_name ?? u.recipe_key ?? ''] : [],
    ingredients: INGREDIENT_UNLOCKS[level] ?? [],
    equipment:   u.type === 'equipment' ? [u.equipment_name ?? u.equipment_key ?? ''] : [],
    // Новые поля
    unlock:      u,
  }
}

// ── Основная функция: начислить XP + левел-апы ────────────────────────────────

export interface XpGainResult {
  xpGained:     number
  newXp:        number
  newLevel:     number
  leveledUp:    boolean
  levelsGained: number
  unlocks:      LevelUnlock[]
  xpToNext:     number
  xpProgress:   number
}

export function computeXpGain(
  currentXp: number,
  currentLevel: number,
  xpGain: number,
): XpGainResult {
  let xp    = currentXp + xpGain
  let level = currentLevel
  const unlocks: LevelUnlock[] = []

  while (true) {
    const needed = xpForLevelUp(level)
    if (xp < needed) break

    xp -= needed
    level++

    const u = getUnlockForLevel(level)
    if (u) unlocks.push(u)

    if (level >= 15) break
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
  xpProgress:  number
  nextUnlock:  LevelUnlock | undefined
  nextUnlocks: ReturnType<typeof getUnlocksForLevel>
}

export function getProgressionSummary(level: number, xp: number): ProgressionSummary {
  const needed     = xpForLevelUp(level)
  const xpProgress = Math.min(xp / needed, 1)

  return {
    level,
    xp,
    xpToNext:    needed,
    xpProgress,
    nextUnlock:  getUnlockForLevel(level + 1),
    nextUnlocks: getUnlocksForLevel(level + 1),
  }
}
