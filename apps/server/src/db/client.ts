import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neon } from '@neondatabase/serverless'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!
  const sql = neon(connectionString)
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter, log: ['error', 'warn'] })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
