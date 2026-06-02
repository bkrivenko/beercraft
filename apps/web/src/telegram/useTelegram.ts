// Хук для работы с Telegram Mini App WebApp API
// Docs: https://core.telegram.org/bots/webapps

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

// Telegram WebApp доступен глобально после подключения скрипта
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        initDataUnsafe: {
          user?: TelegramUser
        }
        initData: string
        colorScheme: 'light' | 'dark'
        close: () => void
      }
    }
  }
}

export function useTelegram() {
  const tg = window.Telegram?.WebApp

  // Вызываем ready() чтобы скрыть лоадер Telegram
  tg?.ready()
  tg?.expand()

  const user = tg?.initDataUnsafe?.user

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
    : 'Пивовар'

  return {
    tg,
    user,
    displayName,
    initData: tg?.initData ?? '',
    isDark: tg?.colorScheme === 'dark',
  }
}
