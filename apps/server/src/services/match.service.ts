/**
 * Match service — A.2.2
 * Запись результатов дуэли, определение победителя, обновление рейтинга (Эло).
 */

import { prisma } from '../db/client.js'
import { makeMatchRng } from '../game/seededRandom.js'
import { GAME_CONFIG } from '../config/game-config.js'

// ── Константы ─────────────────────────────────────────────────────────────────

const ELO_K         = 32    // коэффициент Эло
const ELO_DEFAULT   = GAME_CONFIG.rating.initialElo
const MATCH_TIMEOUT_MIN = 15  // через N минут незавершённый матч отменяется

// Награды за победу/ничью
const REWARDS = {
  win:  { soft: 150, reputation: 10, xp: 50 },
  draw: { soft:  80, reputation:  4, xp: 25 },
  loss: { soft:  30, reputation:  1, xp: 10 },
} as const

// ── Типы ──────────────────────────────────────────────────────────────────────

export interface SubmitResultPayload {
  matchId: string
  batchId: string   // id партии, которую сварил игрок
}

export interface MatchResult {
  matchId:  string
  winnerId: string | null
  isDraw:   boolean
  participants: Array<{
    userId:      string
    displayName: string
    quality:     number | null
    result:      'win' | 'loss' | 'draw'
    ratingDelta: number
    newRating:   number
    rewards:     { soft: number; reputation: number; xp: number }
  }>
  finishedAt: string
}

export class MatchError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'MatchError'
  }
}

// ── Вспомогательные ───────────────────────────────────────────────────────────

/** Эло-расчёт: ожидаемый результат игрока A против B */
function eloExpected(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/** Новый рейтинг после матча. score: 1=победа, 0.5=ничья, 0=поражение */
function eloNew(rating: number, score: number, expected: number): number {
  return Math.round(rating + ELO_K * (score - expected))
}

async function getOrCreateRating(tx: any, userId: bigint, seasonId: bigint): Promise<number> {
  const existing = await tx.rating.findUnique({
    where: { season_id_user_id: { season_id: seasonId, user_id: userId } },
    select: { rating: true },
  })
  if (existing) return existing.rating

  await tx.rating.create({
    data: { season_id: seasonId, user_id: userId, rating: ELO_DEFAULT },
  })
  return ELO_DEFAULT
}

async function getCurrentSeason(tx: any): Promise<bigint> {
  const now = new Date()
  let season = await tx.ratingSeason.findFirst({
    where: { starts_at: { lte: now }, ends_at: { gte: now } },
    select: { id: true },
  })

  if (!season) {
    // Создаём новый сезон на 90 дней
    const ends = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    season = await tx.ratingSeason.create({
      data: {
        name:      `Сезон ${now.toLocaleString('ru', { month: 'long', year: 'numeric' })}`,
        starts_at: now,
        ends_at:   ends,
      },
    })
  }

  return season.id
}

// ── GET /api/v1/match/:id ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMatch(matchId: bigint, userId: bigint): Promise<any> {
  const match = await (prisma as any).match.findUnique({
    where:   { id: matchId },
    include: {
      participants: {
        include: { user: { select: { id: true, display_name: true } }, batch: true },
      },
    },
  })

  if (!match) throw new MatchError('Матч не найден', 'NOT_FOUND')

  const isParticipant = match.participants.some((p: any) => p.user_id === userId)
  if (!isParticipant) throw new MatchError('Нет доступа к матчу', 'FORBIDDEN')

  return serializeMatch(match)
}

// ── POST /api/v1/match/:id/submit ─────────────────────────────────────────────
// Игрок привязывает свою готовую партию к матчу

export async function submitResult(
  matchId: bigint,
  userId:  bigint,
  batchId: bigint,
) {
  const match = await (prisma as any).match.findUnique({
    where:   { id: matchId },
    include: { participants: true },
  })
  if (!match)                            throw new MatchError('Матч не найден', 'NOT_FOUND')
  if (match.status !== 'in_progress')   throw new MatchError('Матч не активен', 'INVALID_STATUS')

  const participant = match.participants.find((p: any) => p.user_id === userId)
  if (!participant)                      throw new MatchError('Вы не участник матча', 'FORBIDDEN')
  if (participant.batch_id)              throw new MatchError('Результат уже отправлен', 'ALREADY_SUBMITTED')

  // Проверяем что партия принадлежит игроку и в статусе ready/sold
  const batch = await (prisma as any).batch.findFirst({
    where: {
      id:         batchId,
      brewery:    { owner_id: userId },
      status:     { in: ['ready', 'fermenting', 'conditioning'] },
    },
    select: { id: true, quality: true, style_id: true },
  })
  if (!batch) throw new MatchError('Партия не найдена или не готова', 'BATCH_NOT_VALID')

  // Привязываем партию к участнику
  await (prisma as any).matchParticipant.update({
    where: { match_id_user_id: { match_id: matchId, user_id: userId } },
    data:  { batch_id: batchId, score: batch.quality ?? 0 },
  })

  // Проверяем: все ли участники сдали результаты?
  const updatedParticipants = await (prisma as any).matchParticipant.findMany({
    where: { match_id: matchId },
  })
  const allSubmitted = updatedParticipants.every((p: any) => p.batch_id !== null)

  if (allSubmitted) {
    return finishMatch(matchId)
  }

  return { status: 'waiting', message: 'Результат принят, ожидаем соперника' }
}

// ── POST /api/v1/match/:id/finish ─────────────────────────────────────────────
// Принудительное завершение (таймаут или оба сдали)

export async function finishMatch(matchId: bigint): Promise<MatchResult> {
  const match = await (prisma as any).match.findUnique({
    where:   { id: matchId },
    include: {
      participants: {
        include: {
          user: { select: { id: true, display_name: true } },
          batch: { select: { quality: true, abv: true, ibu: true, srm: true } },
        },
      },
    },
  })

  if (!match)                       throw new MatchError('Матч не найден', 'NOT_FOUND')
  if (match.status === 'cancelled') throw new MatchError('Матч отменён', 'CANCELLED')
  if (match.status === 'finished')  return getMatch(matchId, match.participants[0]?.user_id) as Promise<MatchResult>

  const parts = match.participants as any[]

  // Определяем победителя по quality
  const withScore = parts.map((p) => ({
    ...p,
    finalScore: p.score ?? (p.batch?.quality ?? 0),
  }))

  withScore.sort((a, b) => b.finalScore - a.finalScore)

  const topScore = withScore[0]?.finalScore ?? 0
  const winners  = withScore.filter((p) => p.finalScore === topScore)
  const isDraw   = winners.length > 1
  const winnerId = isDraw ? null : (winners[0]?.user_id ?? null)

  // Обновляем результаты участников + рейтинг в транзакции
  const resultRows: MatchResult['participants'] = []

  await (prisma as any).$transaction(async (tx: any) => {
    const seasonId = await getCurrentSeason(tx)

    for (const p of withScore) {
      const result: 'win' | 'loss' | 'draw' =
        isDraw ? 'draw' : (p.user_id === winnerId ? 'win' : 'loss')

      // Эло
      const opponentRatings = await Promise.all(
        withScore
          .filter((o) => o.user_id !== p.user_id)
          .map((o) => getOrCreateRating(tx, o.user_id, seasonId)),
      )
      const myRating  = await getOrCreateRating(tx, p.user_id, seasonId)
      const avgOpponent = opponentRatings.length > 0
        ? opponentRatings.reduce((s, r) => s + r, 0) / opponentRatings.length
        : ELO_DEFAULT

      const score    = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0
      const expected = eloExpected(myRating, avgOpponent)
      const newRating = Math.max(100, eloNew(myRating, score, expected))
      const delta     = newRating - myRating

      // Обновляем рейтинг
      await tx.rating.upsert({
        where: { season_id_user_id: { season_id: seasonId, user_id: p.user_id } },
        update: {
          rating:                 newRating,
          wins:    result === 'win'  ? { increment: 1 } : undefined,
          losses:  result === 'loss' ? { increment: 1 } : undefined,
        },
        create: { season_id: seasonId, user_id: p.user_id, rating: newRating },
      })

      // Награды
      const reward = REWARDS[result]
      await tx.user.update({
        where: { id: p.user_id },
        data: {
          soft_currency: { increment: reward.soft },
          reputation:    { increment: reward.reputation },
          xp:            { increment: reward.xp },
        },
      })

      // Транзакция экономики
      await tx.transaction.create({
        data: {
          user_id:  p.user_id,
          type:     'match_reward',
          currency: 'soft',
          amount:   reward.soft,
          reason:   `Дуэль: ${result}`,
          ref_id:   matchId,
        },
      })

      // Обновляем запись участника
      await tx.matchParticipant.update({
        where: { match_id_user_id: { match_id: matchId, user_id: p.user_id } },
        data:  { result },
      })

      resultRows.push({
        userId:      p.user_id.toString(),
        displayName: p.user?.display_name ?? 'Игрок',
        quality:     p.finalScore || null,
        result,
        ratingDelta: delta,
        newRating,
        rewards:     reward,
      })
    }

    // Завершаем матч
    await tx.match.update({
      where: { id: matchId },
      data:  {
        status:      'finished',
        winner_id:   winnerId,
        finished_at: new Date(),
      },
    })
  })

  const finishedAt = new Date().toISOString()

  // WS-уведомление через lobbyStore если комната ещё жива — не нужно здесь,
  // клиент сам перезапрашивает GET /match/:id после submit

  return {
    matchId:     matchId.toString(),
    winnerId:    winnerId?.toString() ?? null,
    isDraw,
    participants: resultRows,
    finishedAt,
  }
}

// ── GET /api/v1/match/:id/seed-data ──────────────────────────────────────────
// Детерминированные данные для мини-игры (дрейф температуры по seed)

export function getSeedData(seed: bigint, steps = 60) {
  const mash  = makeMatchRng(seed, 'mash').driftSequence(steps, 1.5)
  const hops  = makeMatchRng(seed, 'hops').driftSequence(steps, 1.0)
  const chill = makeMatchRng(seed, 'chill').driftSequence(steps, 2.0)

  return {
    seed:  seed.toString(),
    steps,
    drift: { mash, hops, chill },
  }
}

// ── Таймаут незавершённых матчей ──────────────────────────────────────────────

export async function cancelStaleMatches(): Promise<number> {
  const cutoff = new Date(Date.now() - MATCH_TIMEOUT_MIN * 60 * 1000)

  const stale = await (prisma as any).match.findMany({
    where: {
      status:     'in_progress',
      created_at: { lte: cutoff },
    },
    select: { id: true },
  })

  for (const m of stale) {
    // Если хотя бы один сдал — завершаем с победителем, иначе отменяем
    const submitted = await (prisma as any).matchParticipant.count({
      where: { match_id: m.id, batch_id: { not: null } },
    })

    if (submitted > 0) {
      await finishMatch(m.id).catch(() => {/* уже обработано */})
    } else {
      await (prisma as any).match.update({
        where: { id: m.id },
        data:  { status: 'cancelled', finished_at: new Date() },
      })
    }
  }

  return stale.length
}

// ── Сериализация ──────────────────────────────────────────────────────────────

function serializeMatch(match: any) {
  return {
    id:         match.id.toString(),
    mode:       match.mode,
    status:     match.status,
    seed:       match.seed.toString(),
    task:       match.task,
    winnerId:   match.winner_id?.toString() ?? null,
    createdAt:  match.created_at,
    finishedAt: match.finished_at,
    participants: match.participants.map((p: any) => ({
      userId:      p.user_id.toString(),
      displayName: p.user?.display_name ?? 'Игрок',
      isReady:     p.is_ready,
      result:      p.result,
      score:       p.score,
      batchId:     p.batch_id?.toString() ?? null,
      batch: p.batch ? {
        quality: p.batch.quality,
        abv:     p.batch.abv != null ? Number(p.batch.abv) : null,
        ibu:     p.batch.ibu,
        srm:     p.batch.srm != null ? Number(p.batch.srm) : null,
      } : null,
    })),
  }
}
