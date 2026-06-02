/**
 * API-клиент для BeerCraft сервера
 * Автоматически подставляет x-telegram-init-data из Telegram WebApp
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

function getInitData(): string {
  return window.Telegram?.WebApp?.initData ?? ''
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': getInitData(),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status, body.code)
  }
  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export const api = {
  // Профиль
  getMe: () => request<UserProfile>('/api/v1/me'),

  // Партии
  getBatches: () => request<{ items: Batch[]; total: number }>('/api/v1/batches'),
  startBatch: (body: StartBatchBody) =>
    request<Batch>('/api/v1/batches/start', { method: 'POST', body: JSON.stringify(body) }),
  completeStage: (id: string, accuracy: StageAccuracy) =>
    request<Batch>(`/api/v1/batches/${id}/complete-stage`, {
      method: 'POST',
      body: JSON.stringify({ accuracy }),
    }),

  // Профиль / прогрессия
  getStats: () => request<PlayerStats>('/api/v1/me/stats'),

  // Рынок
  getMarketOrders: () => request<{ items: MarketOrder[]; total: number }>('/api/v1/market/orders'),
  getTrends:       () => request<{ items: Trend[] }>('/api/v1/market/trends'),
  getReadyBatches: () => request<{ items: BatchForSale[]; total: number; reputation: number }>('/api/v1/market/batches'),
  getSellPrice:    (batchId: string) => request<SellPrice>(`/api/v1/market/sell-price/${batchId}`),
  sellBatch:       (batchId: string) => request<SellResult>('/api/v1/market/sell', { method: 'POST', body: JSON.stringify({ batchId }) }),
  fulfillOrder:    (orderId: string, batchId: string) => request<FulfillResult>('/api/v1/market/fulfill', { method: 'POST', body: JSON.stringify({ orderId, batchId }) }),

  // Ингредиенты
  getIngredients: () => request<{ items: Ingredient[]; total: number }>('/api/v1/ingredients'),
  getInventory:   () => request<{ items: InventoryItem[]; total: number }>('/api/v1/inventory'),
  purchase: (ingredientKey: string, quantity: number) =>
    request('/api/v1/inventory/purchase', {
      method: 'POST',
      body: JSON.stringify({ ingredientKey, quantity }),
    }),
}

// ── Типы ответов ──────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  displayName: string
  level: number
  xp: number
  softCurrency: number
  premiumCurrency: number
  reputation: number
  brewery: { id: string; name: string; treasury: number }
}

export type BatchStatus = 'mashing' | 'boiling' | 'fermenting' | 'conditioning' | 'ready' | 'sold'

export interface Batch {
  id: string
  status: BatchStatus
  volumeL: number
  startedAt: string
  readyAt: string | null
  secondsLeft: number | null
  og: number | null
  fg: number | null
  abv: number | null
  ibu: number | null
  srm: number | null
  quality: number | null
  styleMatch: number | null
  styleName: string | null
  styleKey: string | null
  accuracy: Record<string, number>
}

export interface Ingredient {
  id: string; key: string; type: string; name: string
  params: Record<string, unknown>; basePrice: number; unit: string; unlockLevel: number
}

export interface InventoryItem {
  ingredientId: string; key: string; name: string
  type: string; unit: string; quantity: number; params: Record<string, unknown>
}

export interface StartBatchBody {
  name: string; targetStyleKey?: string
  malts: Array<{ key: string; amountKg: number }>
  hops:  Array<{ key: string; amountG: number; timing: string }>
  yeastKey: string; waterKey: string
  mashTempC: number; fermentTempC: number; volumeL: number
}

export interface StageAccuracy { mash: number; hops: number; chill: number; ferment?: number }

export interface MarketOrder {
  id: string; customerName: string; styleKey: string | null
  constraints: Record<string, unknown>; rewardSoft: number; rewardRep: number
  deadlineAt: string | null; hoursLeft: number | null
  demandMult: number; trend: 'up' | 'down' | 'neutral'
}

export interface Trend {
  styleKey: string; styleName: string; demandMult: number; trend: 'up' | 'down' | 'neutral'
}

export interface BatchForSale {
  id: string; styleName: string | null; styleKey: string | null
  quality: number | null; abv: number | null; ibu: number | null
  srm: number | null; volumeL: number
  sellPrice?: number; demandMult?: number; qualityMult?: number; reputationMult?: number
}

export interface SellPrice {
  batchId: string; styleName: string | null; quality: number
  basePrice: number; demandMult: number; reputationMult: number; qualityMult: number; sellPrice: number
}

export interface SellResult extends SellPrice { remainingCurrency: number }
export interface Progression {
  level: number; xp: number; xpToNext: number; xpProgress: number
  nextUnlocks?: { level: number; styles: string[]; ingredients: string[]; equipment: string[] }
}

export interface PlayerStats {
  displayName: string; level: number; xp: number
  softCurrency: number; reputation: number; createdAt: string; breweryName: string | null
  progression: Progression
  stats: { brewsTotal: number; soldBatches: number; avgQuality: number | null; totalIncome: number }
  topBatches: Array<{ quality: number; styleName: string; abv: number | null; ibu: number | null }>
  nextLevelUnlocks?: { level: number; styles: string[]; ingredients: string[]; equipment: string[] }
}

export interface FulfillResult {
  orderId: string; customerName: string; rewardSoft: number; rewardRep: number
  remainingCurrency: number; reputation: number
}
