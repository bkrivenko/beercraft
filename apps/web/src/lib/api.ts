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
