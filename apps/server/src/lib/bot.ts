import { Bot } from 'grammy'

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

// ── Тексты уведомлений ────────────────────────────────────────────────────────

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

  const style   = styleName ?? 'Пиво'
  const qualStr = quality != null ? `⭐ Качество: **${quality}/100**` : ''
  const statsStr = [
    abv != null ? `ABV ${abv}%` : null,
    ibu != null ? `IBU ${ibu}` : null,
  ].filter(Boolean).join(' · ')

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
      parse_mode: 'Markdown',
    })
  } catch (err) {
    // Пользователь мог заблокировать бота — не крашим процесс
    console.warn('[bot] failed to notify user', telegramId, (err as Error).message)
  }
}
