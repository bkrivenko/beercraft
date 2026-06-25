import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../../../middleware/auth.js'
import { prisma } from '../../../db/client.js'

// ── Конфигурация оборудования ─────────────────────────────────────────────────
export const EQUIPMENT_CONFIG: Record<string, {
  name: string
  unlockLevel: number
  buyPrice: number
  maxLevel: number
  upgradePrices: number[]
  upgradeLevelReq: number[]
  descriptions: string[]
  bonuses: string[]
}> = {
  kettle: {
    name: 'Варочный котёл',
    unlockLevel: 1, buyPrice: 0,
    maxLevel: 3, upgradePrices: [300, 600], upgradeLevelReq: [2, 4],
    descriptions: ['Медный котёл 50 л', 'Котёл из нержавейки 100 л', 'Проф. котёл 200 л'],
    bonuses: ['Базовое качество', '+5% к качеству', '+10% к качеству'],
  },
  fermenter: {
    name: 'Ферментер',
    unlockLevel: 1, buyPrice: 0,
    maxLevel: 3, upgradePrices: [250, 500], upgradeLevelReq: [2, 4],
    descriptions: ['Пластиковый ферментер', 'Стальной ферментер', 'Конический ферментер'],
    bonuses: ['Базовое брожение', '+5% атт.', '+10% атт.'],
  },
  mash_tun: {
    name: 'Заторный бак',
    unlockLevel: 4, buyPrice: 400,
    maxLevel: 2, upgradePrices: [700], upgradeLevelReq: [5],
    descriptions: ['Заторный бак 80 л', 'Бак с перемешивателем 150 л'],
    bonuses: ['+5% к экстракту', '+12% к экстракту'],
  },
  hop_back: {
    name: 'Хмелевой бак',
    unlockLevel: 6, buyPrice: 600,
    maxLevel: 2, upgradePrices: [1000], upgradeLevelReq: [7],
    descriptions: ['Хмелевой бак', 'Хмелевой бак с фильтром'],
    bonuses: ['+5% IBU точность', '+10% IBU точность'],
  },
  conditioning_tank: {
    name: 'Чан выдержки',
    unlockLevel: 9, buyPrice: 700,
    maxLevel: 2, upgradePrices: [1200], upgradeLevelReq: [9],
    descriptions: ['Чан выдержки 100 л', 'Охлаждаемый чан 200 л'],
    bonuses: ['-15% время выдержки', '-30% время выдержки'],
  },
  bottling_line: {
    name: 'Линия розлива',
    unlockLevel: 8, buyPrice: 1000,
    maxLevel: 1, upgradePrices: [], upgradeLevelReq: [],
    descriptions: ['Ручная линия розлива'],
    bonuses: ['+8% к цене продажи'],
  },
}

// Начальное оборудование (выдаётся при создании пивоварни)
export const STARTER_EQUIPMENT = ['kettle', 'fermenter']

export async function equipmentRoutes(app: FastifyInstance) {

  // ── GET /api/v1/equipment ──────────────────────────────────────────────────
  app.get('/equipment', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const user = await (prisma as any).user.findUnique({
        where:  { telegram_id: BigInt(request.telegramUser.id) },
        select: { brewery: { select: { id: true } } },
      })
      if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

      const breweryId = user.brewery.id

      // Проверяем стартовое оборудование
      const existing = await (prisma as any).equipment.findMany({
        where: { brewery_id: breweryId },
      })

      if (existing.length === 0) {
        // Создаём стартовое оборудование
        await (prisma as any).equipment.createMany({
          data: STARTER_EQUIPMENT.map(type => ({
            brewery_id: breweryId,
            type,
            level: 1,
            params: {},
          })),
        })
      }

      const equipment = await (prisma as any).equipment.findMany({
        where: { brewery_id: breweryId },
        orderBy: { acquired_at: 'asc' },
      })

      const items = equipment.map((e: any) => {
        const cfg = EQUIPMENT_CONFIG[e.type]
        return {
          id:       String(e.id),
          type:     e.type,
          level:    e.level,
          name:     cfg?.name ?? e.type,
          maxLevel: cfg?.maxLevel ?? 1,
          description: cfg?.descriptions[e.level - 1] ?? '',
          bonus:       cfg?.bonuses[e.level - 1] ?? '',
          canUpgrade:  cfg ? e.level < cfg.maxLevel : false,
          upgradePrice: cfg?.upgradePrices[e.level - 1] ?? null,
          upgradeLevelReq: cfg?.upgradeLevelReq[e.level - 1] ?? null,
        }
      })

      return reply.send({ items })
    } catch (err) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ── POST /api/v1/equipment/buy ─────────────────────────────────────────────
  app.post<{ Body: { type: string } }>('/equipment/buy', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { type } = request.body
      const cfg = EQUIPMENT_CONFIG[type]
      if (!cfg) return reply.code(400).send({ error: 'Unknown equipment type' })

      const user = await (prisma as any).user.findUnique({
        where:  { telegram_id: BigInt(request.telegramUser.id) },
        select: { id: true, level: true, soft_currency: true, brewery: { select: { id: true } } },
      })
      if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

      if (user.level < cfg.unlockLevel) {
        return reply.code(400).send({ error: `Требуется уровень ${cfg.unlockLevel}` })
      }

      // Проверяем что ещё нет
      const existing = await (prisma as any).equipment.findFirst({
        where: { brewery_id: user.brewery.id, type },
      })
      if (existing) return reply.code(400).send({ error: 'Equipment already owned' })

      if (user.soft_currency < cfg.buyPrice) {
        return reply.code(400).send({ error: 'INSUFFICIENT_FUNDS' })
      }

      // Транзакция: списываем монеты + создаём оборудование
      await (prisma as any).$transaction([
        (prisma as any).user.update({
          where: { id: user.id },
          data:  { soft_currency: { decrement: cfg.buyPrice } },
        }),
        (prisma as any).equipment.create({
          data: { brewery_id: user.brewery.id, type, level: 1, params: {} },
        }),
        ...(cfg.buyPrice > 0 ? [(prisma as any).transaction.create({
          data: {
            user_id:  user.id,
            type:     'purchase_equipment',
            currency: 'soft',
            amount:   cfg.buyPrice,
            reason:   `Покупка: ${cfg.name}`,
          },
        })] : []),
      ])

      return reply.send({ ok: true })
    } catch (err) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ── POST /api/v1/equipment/upgrade ────────────────────────────────────────
  app.post<{ Body: { type: string } }>('/equipment/upgrade', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { type } = request.body
      const cfg = EQUIPMENT_CONFIG[type]
      if (!cfg) return reply.code(400).send({ error: 'Unknown equipment type' })

      const user = await (prisma as any).user.findUnique({
        where:  { telegram_id: BigInt(request.telegramUser.id) },
        select: { id: true, level: true, soft_currency: true, brewery: { select: { id: true } } },
      })
      if (!user?.brewery) return reply.code(404).send({ error: 'Brewery not found' })

      const equip = await (prisma as any).equipment.findFirst({
        where: { brewery_id: user.brewery.id, type },
      })
      if (!equip) return reply.code(404).send({ error: 'Equipment not found' })
      if (equip.level >= cfg.maxLevel) return reply.code(400).send({ error: 'Already max level' })

      const upgradePrice = cfg.upgradePrices[equip.level - 1]
      const levelReq     = cfg.upgradeLevelReq[equip.level - 1]

      if (user.level < levelReq) {
        return reply.code(400).send({ error: `Требуется уровень ${levelReq}` })
      }
      if (user.soft_currency < upgradePrice) {
        return reply.code(400).send({ error: 'INSUFFICIENT_FUNDS' })
      }

      await (prisma as any).$transaction([
        (prisma as any).user.update({
          where: { id: user.id },
          data:  { soft_currency: { decrement: upgradePrice } },
        }),
        (prisma as any).equipment.update({
          where: { id: equip.id },
          data:  { level: equip.level + 1 },
        }),
        (prisma as any).transaction.create({
          data: {
            user_id:  user.id,
            type:     'purchase_equipment',
            currency: 'soft',
            amount:   upgradePrice,
            reason:   `Улучшение: ${cfg.name} до ур. ${equip.level + 1}`,
          },
        }),
      ])

      return reply.send({ ok: true, newLevel: equip.level + 1 })
    } catch (err) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
