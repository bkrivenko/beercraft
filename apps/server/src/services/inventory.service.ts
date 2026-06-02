import { prisma } from '../db/client.js'

// ── Каталог ингредиентов (по уровню игрока) ───────────────────────────────────

export async function getIngredientsCatalog(playerLevel: number) {
  const ingredients = await prisma.ingredient.findMany({
    where: { unlock_level: { lte: playerLevel } },
    orderBy: [{ type: 'asc' }, { unlock_level: 'asc' }],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ingredients.map((i: any) => ({
    id: i.id.toString(),
    key: i.key,
    type: i.type,
    name: i.name,
    params: i.params,
    basePrice: i.base_price,
    unit: i.unit,
    unlockLevel: i.unlock_level,
  }))
}

// ── Склад пивоварни ───────────────────────────────────────────────────────────

export async function getInventory(breweryId: bigint) {
  const items = await prisma.inventory.findMany({
    where: { brewery_id: breweryId },
    include: {
      ingredient: {
        select: { key: true, name: true, type: true, unit: true, params: true },
      },
    },
    orderBy: { ingredient: { type: 'asc' } },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.map((item: any) => ({
    ingredientId: item.ingredient_id.toString(),
    key: item.ingredient.key,
    name: item.ingredient.name,
    type: item.ingredient.type,
    unit: item.ingredient.unit,
    params: item.ingredient.params,
    quantity: Number(item.quantity),
  }))
}

// ── Покупка ингредиента ───────────────────────────────────────────────────────

interface PurchaseParams {
  userId: bigint
  breweryId: bigint
  ingredientKey: string
  quantity: number        // кол-во единиц (кг / 100г / внесений)
  playerLevel: number
}

export async function purchaseIngredient({
  userId,
  breweryId,
  ingredientKey,
  quantity,
  playerLevel,
}: PurchaseParams) {
  if (quantity <= 0) throw new PurchaseError('Количество должно быть > 0', 'INVALID_QUANTITY')

  // 1. Находим ингредиент
  const ingredient = await prisma.ingredient.findUnique({
    where: { key: ingredientKey },
  })
  if (!ingredient) throw new PurchaseError('Ингредиент не найден', 'NOT_FOUND')
  if (ingredient.unlock_level > playerLevel) {
    throw new PurchaseError('Ингредиент недоступен на вашем уровне', 'LOCKED')
  }

  // 2. Ищем цену в store_catalog (может быть другой, чем base_price)
  const catalogEntry = await prisma.storeCatalog.findFirst({
    where: { ref_key: ingredientKey, kind: 'ingredient', enabled: true },
  })
  const pricePerUnit = catalogEntry?.price_amount ?? ingredient.base_price
  const totalCost = Math.round(pricePerUnit * quantity)

  // 3. Проверяем флаги фичей (monetization выключен на старте)
  if (catalogEntry?.feature_flag) {
    throw new PurchaseError('Товар временно недоступен', 'FEATURE_DISABLED')
  }

  // 4. Транзакция: списать монеты → добавить в инвентарь → записать транзакцию
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx: any) => {
    // Проверка баланса
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, soft_currency: true },
    })
    if (user.soft_currency < totalCost) {
      throw new PurchaseError(
        `Недостаточно монет: нужно ${totalCost}, есть ${user.soft_currency}`,
        'INSUFFICIENT_FUNDS',
      )
    }

    // Списываем монеты
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { soft_currency: { decrement: totalCost } },
      select: { soft_currency: true },
    })

    // Добавляем в инвентарь (upsert по brewery+ingredient)
    const inventoryItem = await tx.inventory.upsert({
      where: {
        brewery_id_ingredient_id: {
          brewery_id: breweryId,
          ingredient_id: ingredient.id,
        },
      },
      create: {
        brewery_id: breweryId,
        ingredient_id: ingredient.id,
        quantity: quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
    })

    // Пишем в транзакции экономики
    await tx.transaction.create({
      data: {
        user_id: userId,
        type: 'purchase_ingredient',
        currency: 'soft',
        amount: -totalCost,
        reason: `Покупка: ${ingredient.name} x${quantity} ${ingredient.unit}`,
        ref_id: ingredient.id,
      },
    })

    return {
      ingredientKey,
      ingredientName: ingredient.name,
      quantity,
      unit: ingredient.unit,
      totalCost,
      remainingCurrency: updatedUser.soft_currency,
      newQuantity: Number(inventoryItem.quantity),
    }
  })

  return result
}

// ── Кастомная ошибка ──────────────────────────────────────────────────────────

export class PurchaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'PurchaseError'
  }
}
