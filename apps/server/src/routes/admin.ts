/**
 * Admin panel routes.
 * Auth: ADMIN_SECRET env var passed as ?secret=xxx query param OR Authorization header.
 * All routes are prefixed with /admin.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/client.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Auth guard ────────────────────────────────────────────────────────────────
function checkSecret(request: FastifyRequest, reply: FastifyReply): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    reply.code(503).send({ error: 'ADMIN_SECRET not configured on server' })
    return false
  }
  const qs     = (request.query as Record<string, string>).secret
  const header = (request.headers['authorization'] ?? '').replace('Bearer ', '')
  if (qs !== secret && header !== secret) {
    reply.code(401).send({ error: 'Unauthorized' })
    return false
  }
  return true
}

// ── HTML UI ───────────────────────────────────────────────────────────────────
const HTML_PATH = join(__dirname, '../../admin.html')
function getAdminHtml(): string {
  try {
    return readFileSync(HTML_PATH, 'utf-8')
  } catch {
    return '<html><body><p>admin.html not found</p></body></html>'
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function adminRoutes(app: FastifyInstance) {

  // GET /admin — serve HTML UI
  app.get('/admin', async (request, reply) => {
    if (!checkSecret(request, reply)) return
    reply.header('Content-Type', 'text/html; charset=utf-8').send(getAdminHtml())
  })

  // GET /admin/users — paginated user list
  app.get('/admin/users', async (request, reply) => {
    if (!checkSecret(request, reply)) return
    const q = request.query as Record<string, string>
    const page  = Math.max(1, parseInt(q.page  ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '50', 10)))
    const search = (q.search ?? '').trim()

    const where = search
      ? {
          OR: [
            { username:     { contains: search, mode: 'insensitive' as const } },
            { display_name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id:           true,
          telegram_id:  true,
          username:     true,
          display_name: true,
          level:        true,
          xp:           true,
          soft_currency: true,
          reputation:   true,
          is_blocked:   true,
          created_at:   true,
          last_seen_at: true,
          brewery: {
            select: {
              id:   true,
              name: true,
              _count: { select: { batches: true } },
            },
          },
        },
      }),
    ])

    return {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      users: users.map((u: typeof users[number]) => ({
        id:           u.id.toString(),
        telegramId:   u.telegram_id.toString(),
        username:     u.username,
        displayName:  u.display_name,
        level:        u.level,
        xp:           u.xp,
        softCurrency: u.soft_currency,
        reputation:   u.reputation,
        isBlocked:    u.is_blocked,
        createdAt:    u.created_at,
        lastSeenAt:   u.last_seen_at,
        brewery: u.brewery ? {
          id:         u.brewery.id.toString(),
          name:       u.brewery.name,
          batchCount: u.brewery._count.batches,
        } : null,
      })),
    }
  })

  // POST /admin/users/:id/block — toggle block
  app.post('/admin/users/:id/block', async (request, reply) => {
    if (!checkSecret(request, reply)) return
    const { id } = request.params as { id: string }
    const user = await prisma.user.findUnique({
      where:  { id: BigInt(id) },
      select: { id: true, is_blocked: true },
    })
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const updated = await prisma.user.update({
      where: { id: BigInt(id) },
      data:  { is_blocked: !user.is_blocked },
      select: { id: true, is_blocked: true },
    })
    return { id: updated.id.toString(), isBlocked: updated.is_blocked }
  })

  // DELETE /admin/users/:id — hard delete
  app.delete('/admin/users/:id', async (request, reply) => {
    if (!checkSecret(request, reply)) return
    const { id } = request.params as { id: string }
    const user = await prisma.user.findUnique({
      where:  { id: BigInt(id) },
      select: { id: true },
    })
    if (!user) return reply.code(404).send({ error: 'User not found' })

    // Cascade delete takes care of brewery → batches → inventory etc.
    await prisma.user.delete({ where: { id: BigInt(id) } })
    return { ok: true, deleted: id }
  })
}
