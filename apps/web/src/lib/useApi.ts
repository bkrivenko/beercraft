import { useState, useEffect, useCallback, useRef } from 'react'
import { api, type UserProfile, type Batch } from './api'

// ── useProfile ────────────────────────────────────────────────────────────────

export function useProfile() {
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getMe()
      setProfile(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки профиля')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { profile, loading, error, reload: load }
}

// ── useBatches ────────────────────────────────────────────────────────────────

export function useBatches(pollIntervalMs = 10_000) {
  const [batches, setBatches]   = useState<Batch[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.getBatches()
      setBatches(data.items)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, pollIntervalMs)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load, pollIntervalMs])

  return { batches, loading, error, reload: load }
}

// ── useCountdown ──────────────────────────────────────────────────────────────
// Тикает каждую секунду — для отображения обратного отсчёта на карточке

export function useCountdown(readyAt: string | null): number {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    readyAt ? Math.max(0, Math.round((new Date(readyAt).getTime() - Date.now()) / 1000)) : 0,
  )

  useEffect(() => {
    if (!readyAt) { setSecondsLeft(0); return }

    const tick = () => {
      const left = Math.max(0, Math.round((new Date(readyAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(left)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [readyAt])

  return secondsLeft
}

// ── formatCountdown ───────────────────────────────────────────────────────────

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Готово'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`
  if (m > 0) return `${m}м ${String(s).padStart(2, '0')}с`
  return `${s}с`
}
