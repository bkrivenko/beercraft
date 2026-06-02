// Prisma 7: клиент генерируется после `npx prisma generate`
// Для работы нужна переменная DATABASE_URL в .env
// Запустить: cd apps/server && npx prisma generate

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — типы появятся после `prisma generate`
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> }

export const prisma: InstanceType<typeof PrismaClient> =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error', 'warn'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
