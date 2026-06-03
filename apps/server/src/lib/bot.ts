import { Bot, InlineKeyboard } from 'grammy'

let _bot: Bot | null = null

export function getBot(): Bot | null {
  const token = process.env.BOT_TOKEN
  if (!token) {
    console.warn('[bot] BOT_TOKEN not set — notifications disabled')
    return null
  }
  if (!_bot) {
    _bot = new Bot(token)
  }
  return _bot
}

// ── Ссылки ────────────────────────────────────────────────────────────────────

export function makeInviteLink(code: string): string {
  const botUsername = process.env.BOT_USERNAME ?? 'BeerCraftBot'
  return `https://t.me/${botUsername}?startapp=duel_${code}`
}

export function makeMiniAppUrl(startParam?: string): string {
  const botUsername = process.env.BOT_USERNAME ?? 'BeerCraftBot'
  const base = `https://t.me/${botUsername}/app`
  return startParam ? `${base}?startapp=${startParam}` : base
}

// ── Инициализация хэндлеров бота (вызывать один раз при старте) ───────────────

export function setupBotHandlers(): void {
  const bot = getBot()
  if (!bot) return

  // /start — обычный вход или deep link ?startapp=duel_CODE
  bot.command('start', async (ctx) => {
    const param = ctx.match?.trim()

    if (param?.startsWith('duel_')) {
      const code = param.slice(5).toUpperCase()
      const keyboard = new InlineKeyboard()
        .webApp('⚔️ Принять вызов', makeMiniAppUrl(`duel_${code}`))

      await ctx.reply(
        `⚔️ *Вас вызвали на дуэль!*\n\nКод комнаты: \`${code}\`\n\nНажмите кнопку чтобы открыть игру и принять вызов.`,
        { parse_mode: 'Markdown', reply_markup: keyboard },
      )
      return
    }

    // Обычный /start
    const keyboard = new InlineKeyboard()
      .webApp('🍺 Открыть BeerCraft', makeMiniAppUrl())

    await ctx.reply(
      '🍺 *Добро пожаловать в BeerCraft!*\n\nВарите крафтовое пиво, выполняйте заказы и сражайтесь в дуэлях!',
      { parse_mode: 'Markdown', reply_markup: keyboard },
    )
  })

  // /duel — быстрая команда для вызова на дуэль (инструкция)
  bot.command('duel', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .webApp('⚔️ Создать дуэль', makeMiniAppUrl('create_duel'))

    await ctx.reply(
      '⚔️ *Дуэль пивоваров*\n\nСоздайте комнату в игре и поделитесь ссылкой с другом.',
      { parse_mode: 'Markdown', reply_markup: keyboard },
    )
  })

  // /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      '🍺 *BeerCraft — команды*\n\n' +
      '/start — открыть игру\n' +
      '/duel — создать дуэль\n' +
      '/help — помощь',
      { parse_mode: 'Markdown' },
    )
  })

  console.log('[bot] handlers registered')
}

// ── Уведомление: партия готова ────────────────────────────────────────────────

export async function notifyBatchReady(params: {
  telegramId: bigint | number
  batchId:    string
  styleName:  string | null
  quality:    number | null
  abv:        number | null
  ibu:        number | null
}) {
  const bot = getBot()
  if (!bot) return

  const { telegramId, styleName, quality, abv, ibu } = params
  const style    = styleName ?? 'Пиво'
  const qualStr  = quality != null ? `⭐ Качество: *${quality}/100*` : ''
  const statsStr = [
    abv != null ? `ABV ${abv}%` : null,
    ibu != null ? `IBU ${ibu}` : null,
  ].filter(Boolean).join(' · ')

  const keyboard = new InlineKeyboard()
    .webApp('🍺 Открыть игру', makeMiniAppUrl())

  const text = [
    `🍺 *Партия готова!*`,
    `Стиль: *${style}*`,
    qualStr,
    statsStr ? `📊 ${statsStr}` : null,
    '',
    '👉 Открой игру чтобы забрать пиво',
  ].filter((l) => l !== null).join('\n')

  try {
    await bot.api.sendMessage(Number(telegramId), text, {
      parse_mode:   'Markdown',
      reply_markup: keyboard,
    })
  } catch (err) {
    console.warn('[bot] failed to notify user', telegramId, (err as Error).message)
  }
}

// ── Уведомление: вызов на дуэль ───────────────────────────────────────────────

export async function notifyDuelInvite(params: {
  toTelegramId:   bigint | number
  fromName:       string
  roomCode:       string
  styleKey?:      string
  styleName?:     string
}) {
  const bot = getBot()
  if (!bot) return

  const { toTelegramId, fromName, roomCode, styleName } = params
  const styleStr = styleName ? `\nЗадание: *${styleName}*` : ''

  const keyboard = new InlineKeyboard()
    .webApp('⚔️ Принять вызов', makeMiniAppUrl(`duel_${roomCode}`))

  try {
    await bot.api.sendMessage(
      Number(toTelegramId),
      `⚔️ *${fromName}* вызывает вас на дуэль!${styleStr}\n\nКод комнаты: \`${roomCode}\``,
      { parse_mode: 'Markdown', reply_markup: keyboard },
    )
  } catch (err) {
    console.warn('[bot] failed to send duel invite', toTelegramId, (err as Error).message)
  }
}

// ── Уведомление: результат дуэли ──────────────────────────────────────────────

export async function notifyDuelResult(params: {
  telegramId:  bigint | number
  result:      'win' | 'loss' | 'draw'
  myQuality:   number | null
  oppName:     string
  oppQuality:  number | null
  ratingDelta: number
  newRating:   number
}) {
  const bot = getBot()
  if (!bot) return

  const { telegramId, result, myQuality, oppName, oppQuality, ratingDelta, newRating } = params

  const emoji  = result === 'win' ? '🏆' : result === 'draw' ? '🤝' : '💔'
  const label  = result === 'win' ? 'Победа!' : result === 'draw' ? 'Ничья' : 'Поражение'
  const delta  = ratingDelta >= 0 ? `+${ratingDelta}` : `${ratingDelta}`

  const keyboard = new InlineKeyboard()
    .webApp('🍺 Сыграть ещё', makeMiniAppUrl())

  try {
    await bot.api.sendMessage(
      Number(telegramId),
      `${emoji} *${label}*\n\n` +
      `Ваш результат: *${myQuality ?? '—'}/100*\n` +
      `${oppName}: *${oppQuality ?? '—'}/100*\n\n` +
      `Рейтинг: *${delta}* (итого ${newRating})`,
      { parse_mode: 'Markdown', reply_markup: keyboard },
    )
  } catch (err) {
    console.warn('[bot] failed to send duel result', telegramId, (err as Error).message)
  }
}

// ── Запуск polling (dev) / webhook (prod) ─────────────────────────────────────

export async function startBot(): Promise<void> {
  const bot = getBot()
  if (!bot) return

  setupBotHandlers()

  const webhookUrl = process.env.WEBHOOK_URL
  if (webhookUrl) {
    // Продакшн: Telegram шлёт апдейты на наш сервер
    await bot.api.setWebhook(webhookUrl)
    console.log('[bot] webhook set:', webhookUrl)
  } else {
    // Dev: polling
    void bot.start({ drop_pending_updates: true })
    console.log('[bot] polling started')
  }
}

export async function stopBot(): Promise<void> {
  const bot = getBot()
  if (!bot) return
  await bot.stop()
}
