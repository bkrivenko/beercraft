import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const prisma = new PrismaClient()

const __dirname = dirname(fileURLToPath(import.meta.url))
const contentPath = resolve(__dirname, '../../../docs/beercraft_content.json')
const content = JSON.parse(readFileSync(contentPath, 'utf8'))

// ── Типы из JSON ──────────────────────────────────────────────────────────────

interface RawIngredient {
  key: string
  type: string
  name: string
  params: Record<string, unknown>
  base_price: number
  unit: string
  unlock_level: number
}

interface RawStyle {
  key: string
  name: string
  family?: string
  og?: [number, number]
  fg?: [number, number]
  abv?: [number, number]
  ibu?: [number, number]
  srm?: [number, number]
  bugu_target?: [number, number]
  profile?: Record<string, unknown>
  base_price?: number
  difficulty?: number
  unlock_level?: number
  description?: string
  recipe_template?: Record<string, unknown>
}

interface RawEquipment {
  key: string
  name: string
  price: number
  unlock_level: number
  effect: Record<string, unknown>
  starter?: boolean
}

interface RawStoreCatalog {
  kind: string
  ref_key: string
  title: string
  price_currency: string
  price_amount: number
  enabled: boolean
  feature_flag: string | null
  unlock_level: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dec(v: number | undefined): string | undefined {
  return v != null ? String(v) : undefined
}

// ── Seed functions ────────────────────────────────────────────────────────────

async function seedIngredients() {
  const rows: RawIngredient[] = content.ingredients ?? []

  // water_profiles добавляем как ингредиенты типа 'water'
  const waterRows = (content.water_profiles ?? []).map(
    (w: { key: string; name: string; lean: string; best_for: string[] }) => ({
      key: w.key,
      type: 'water',
      name: w.name,
      params: { lean: w.lean, best_for: w.best_for },
      base_price: 0,
      unit: 'profile',
      unlock_level: 1,
    }),
  )

  const all = [...rows, ...waterRows]

  let created = 0
  let skipped = 0

  for (const ing of all) {
    const result = await prisma.ingredient.upsert({
      where: { key: ing.key },
      create: {
        key: ing.key,
        type: ing.type as never,
        name: ing.name,
        params: ing.params,
        base_price: ing.base_price,
        unit: ing.unit,
        unlock_level: ing.unlock_level,
      },
      update: {
        name: ing.name,
        params: ing.params,
        base_price: ing.base_price,
        unit: ing.unit,
        unlock_level: ing.unlock_level,
      },
    })
    result ? created++ : skipped++
  }

  console.log(`✅ Ingredients: ${created} upserted (${all.length} total)`)
}

async function seedBeerStyles() {
  const rows: RawStyle[] = content.styles ?? []
  let count = 0

  for (const s of rows) {
    await prisma.beerStyle.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        name: s.name,
        family: s.family ?? null,
        og_min: dec(s.og?.[0]),
        og_max: dec(s.og?.[1]),
        fg_min: dec(s.fg?.[0]),
        fg_max: dec(s.fg?.[1]),
        abv_min: dec(s.abv?.[0]),
        abv_max: dec(s.abv?.[1]),
        ibu_min: s.ibu?.[0] ?? null,
        ibu_max: s.ibu?.[1] ?? null,
        srm_min: dec(s.srm?.[0]),
        srm_max: dec(s.srm?.[1]),
        bugu_min: dec(s.bugu_target?.[0]),
        bugu_max: dec(s.bugu_target?.[1]),
        profile: (s.profile ?? s.recipe_template ?? {}) as never,
        base_price: s.base_price ?? 90,
        difficulty: s.difficulty ?? 1,
        unlock_level: s.unlock_level ?? 1,
        description: s.description ?? null,
        is_custom: false,
        is_public: true,
      },
      update: {
        name: s.name,
        family: s.family ?? null,
        og_min: dec(s.og?.[0]),
        og_max: dec(s.og?.[1]),
        fg_min: dec(s.fg?.[0]),
        fg_max: dec(s.fg?.[1]),
        abv_min: dec(s.abv?.[0]),
        abv_max: dec(s.abv?.[1]),
        ibu_min: s.ibu?.[0] ?? null,
        ibu_max: s.ibu?.[1] ?? null,
        srm_min: dec(s.srm?.[0]),
        srm_max: dec(s.srm?.[1]),
        bugu_min: dec(s.bugu_target?.[0]),
        bugu_max: dec(s.bugu_target?.[1]),
        profile: (s.profile ?? s.recipe_template ?? {}) as never,
        base_price: s.base_price ?? 90,
        difficulty: s.difficulty ?? 1,
        unlock_level: s.unlock_level ?? 1,
      },
    })
    count++
  }

  console.log(`✅ Beer styles: ${count} upserted`)
}

async function seedStoreCatalog() {
  // Сначала сидим equipment_catalog как store entries типа 'equipment'
  const equipment: RawEquipment[] = content.equipment_catalog ?? []
  const equipmentStoreRows = equipment.map((e) => ({
    kind: 'equipment' as const,
    ref_key: e.key,
    title: e.name,
    price_currency: 'soft' as const,
    price_amount: e.price,
    enabled: true,
    feature_flag: null,
    unlock_level: e.unlock_level,
  }))

  // Готовые store_catalog записи из JSON
  const storeRows: RawStoreCatalog[] = content.store_catalog ?? []

  // Объединяем, store_catalog имеет приоритет (upsert по ref_key+kind)
  const allStore = [...equipmentStoreRows, ...storeRows]

  // Очищаем и переписываем (seed идемпотентный — deleteMany + createMany)
  await prisma.storeCatalog.deleteMany()
  await prisma.storeCatalog.createMany({
    data: allStore.map((r) => ({
      kind: r.kind as never,
      ref_key: r.ref_key,
      title: r.title,
      price_currency: r.price_currency as never,
      price_amount: r.price_amount,
      enabled: r.enabled,
      feature_flag: r.feature_flag,
      unlock_level: r.unlock_level,
    })),
    skipDuplicates: true,
  })

  console.log(`✅ Store catalog: ${allStore.length} records`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting seed...\n')

  await seedIngredients()
  await seedBeerStyles()
  await seedStoreCatalog()

  console.log('\n🍺 Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
