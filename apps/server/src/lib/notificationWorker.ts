/**
 * Воркер уведомлений о готовности партий.
 *
 * Архитектура (без постоянного воркера на каждого игрока, как указано в ТЗ §9.4):
 * - При старте партии пишем в Redis ключ с TTL = secondsUntilReady
 * - Воркер раз в POLL_INTERVAL проверяет партии в статусах fermenting/conditioning
 *   у которых ready_at уже прошёл, но статус ещё не обновлён
 * - Продвигает статусы и отправляет уведомления через grammy
 */

import { prisma } from '../db/client.js'
import { notifyBatchReady } from './bot.js'

const POLL_INTERVAL_MS = 60_000  // проверяем раз в минуту

let workerTimer: ReturnType<typeof setInterval> | null = null
let running = false   // защита от параллельных циклов

export function startNotificationWorker() {
  if (workerTimer) return  // уже запущен

  console.log('[worker] notification worker started, interval:', POLL_INTERVAL_MS / 1000, 's')

  // Первый прогон сразу
  void runWorkerCycle()
  workerTimer = setInterval(() => { void runWorkerCycle() }, POLL_INTERVAL_MS)
}

export function stopNotificationWorker() {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
    console.log('[worker] notification worker stopped')
  }
}

async function runWorkerCycle() {
  if (running) return   // предыдущий цикл ещё не завершился
  running = true
  try {
    const now = new Date()

    // ── 1. fermenting → conditioning ─────────────────────────────────────────
    const fermentingDone = await (prisma as any).batch.findMany({
      where: {
        status:   'fermenting',
        ready_at: { lte: now },
      },
      include: {
        brewery: {
          include: { owner: { select: { telegram_id: true } } },
        },
        style: { select: { name: true } },
      },
    })

    for (const batch of fermentingDone) {
      const conditioningReadyAt = new Date(now.getTime() + 2 * 60 * 60 * 1000) // +2ч

      await (prisma as any).batch.update({
        where: { id: batch.id },
        data:  { status: 'conditioning', ready_at: conditioningReadyAt },
      })

      console.log(`[worker] batch ${batch.id} fermenting → conditioning`)
    }

    // ── 2. conditioning → ready + уведомление ────────────────────────────────
    const conditioningDone = await (prisma as any).batch.findMany({
      where: {
        status:   'conditioning',
        ready_at: { lte: now },
      },
      include: {
        brewery: {
          include: { owner: { select: { id: true, telegram_id: true } } },
        },
        style: { select: { name: true } },
      },
    })

    for (const batch of conditioningDone) {
      await (prisma as any).batch.update({
        where: { id: batch.id },
        data:  { status: 'ready', ready_at: null },
      })

      console.log(`[worker] batch ${batch.id} conditioning → ready, notifying...`)

      // Отправляем уведомление владельцу
      const telegramId = batch.brewery?.owner?.telegram_id
      if (telegramId) {
        await notifyBatchReady({
          telegramId,
          batchId:   batch.id.toString(),
          styleName: batch.style?.name ?? null,
          quality:   batch.quality,
          abv:       batch.abv != null ? Number(batch.abv) : null,
          ibu:       batch.ibu,
        })
      }
    }

    if (fermentingDone.length + conditioningDone.length > 0) {
      console.log(
        `[worker] cycle done: ${fermentingDone.length} → conditioning, ${conditioningDone.length} → ready`,
      )
    }
  } catch (err) {
    console.error('[worker] cycle error:', (err as Error).message)
  } finally {
    running = false
  }
}
