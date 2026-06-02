import { defineConfig } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    async adapter() {
      const { PrismaNeon } = await import('@prisma/adapter-neon')
      const { neon } = await import('@neondatabase/serverless')
      const connectionString = process.env.DATABASE_URL!
      const sql = neon(connectionString)
      return new PrismaNeon({ connectionString })
    },
  },
})
