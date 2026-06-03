/**
 * Генерация заданий для дуэли — детерминированно по seed.
 * Одинаковый seed → одинаковое задание у обоих игроков (честность).
 */

import type { DuelTask } from '../lib/lobbyStore.js'

interface TaskTemplate {
  styleKey:   string
  styleName:  string
  budgetSoft: number
  timeSec:    number
}

// Шаблоны заданий по уровню сложности
const TASK_POOL: TaskTemplate[] = [
  { styleKey: 'pale_ale',   styleName: 'American Pale Ale',  budgetSoft: 300, timeSec: 300 },
  { styleKey: 'ipa',        styleName: 'American IPA',        budgetSoft: 400, timeSec: 300 },
  { styleKey: 'hefeweizen', styleName: 'Hefeweizen',          budgetSoft: 280, timeSec: 270 },
  { styleKey: 'stout',      styleName: 'Dry Irish Stout',     budgetSoft: 350, timeSec: 300 },
  { styleKey: 'porter',     styleName: 'Robust Porter',       budgetSoft: 380, timeSec: 300 },
  { styleKey: 'pilsner',    styleName: 'Czech Pilsner',       budgetSoft: 320, timeSec: 360 },
  { styleKey: 'neipa',      styleName: 'New England IPA',     budgetSoft: 500, timeSec: 360 },
  { styleKey: 'saison',     styleName: 'Saison',              budgetSoft: 380, timeSec: 300 },
  { styleKey: 'witbier',    styleName: 'Witbier',             budgetSoft: 280, timeSec: 270 },
  { styleKey: 'brown',      styleName: 'American Brown Ale',  budgetSoft: 330, timeSec: 300 },
]

/**
 * Детерминированный выбор задания по seed.
 * Одинаковый seed → одинаковое задание.
 */
export function pickTaskBySeed(seed: bigint): DuelTask {
  const idx = Number(seed % BigInt(TASK_POOL.length))
  return { ...TASK_POOL[Math.abs(idx)] }
}
