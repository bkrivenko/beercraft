/**
 * Система туториала — пошаговое обучение до 2-го уровня.
 * Прогресс хранится в localStorage.
 */

export interface TutorialStep {
  id:       string
  screen:   string          // на каком экране показывать
  emoji:    string
  title:    string
  text:     string
  action?:  string          // текст кнопки (если нет — показываем только "Понятно")
  highlight?: string        // CSS data-tutorial атрибут элемента для подсветки
  arrow?:   'up' | 'down' | 'left' | 'right'  // куда указывает стрелка
  completeOn: 'dismiss' | 'navigate' // когда шаг завершается
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── Экран: home ────────────────────────────────────────────────────────────
  {
    id:         'home_welcome',
    screen:     'home',
    emoji:      '🍺',
    title:      'Добро пожаловать в пивоварню!',
    text:       'Здесь будут твои варки. Нажми кнопку "🍺 Варить" чтобы начать первую партию пива.',
    highlight:  'brew-button',
    arrow:      'down',
    completeOn: 'navigate',
  },
  // ── Экран: recipe ───────────────────────────────────────────────────────────
  {
    id:         'recipe_style',
    screen:     'recipe',
    emoji:      '📖',
    title:      'Выбери стиль пива',
    text:       'Сначала выбери что варить. Начни с Pale Ale — это классика. Каждый стиль имеет свои параметры: IBU (горечь), ABV (крепость) и SRM (цвет).',
    highlight:  'style-select',
    arrow:      'up',
    completeOn: 'dismiss',
  },
  {
    id:         'recipe_ingredients',
    screen:     'recipe',
    emoji:      '🌾',
    title:      'Ингредиенты',
    text:       'Пиво состоит из: 🌾 Солод — основа, даёт цвет и сладость. 🌿 Хмель — горечь и аромат. 🧫 Дрожжи — брожение, крепость. 💧 Вода — профиль вкуса.',
    completeOn: 'dismiss',
  },
  {
    id:         'recipe_brew',
    screen:     'recipe',
    emoji:      '✨',
    title:      'Оптимальный рецепт',
    text:       'Нажми "🍺 Варить" — система автоматически подберёт правильные количества ингредиентов для максимального попадания в стиль.',
    highlight:  'brew-button',
    arrow:      'up',
    completeOn: 'navigate',
  },
  // ── Экран: brewing (мини-игра) ──────────────────────────────────────────────
  {
    id:         'minigame_explain',
    screen:     'brewing',
    emoji:      '🎯',
    title:      'Мини-игра варки',
    text:       'Ползунок движется по шкале. Нажимай "ЖМИ!" когда он в жёлтой зоне — чем точнее попадёшь, тем лучше получится пиво!',
    highlight:  'game-button',
    arrow:      'up',
    completeOn: 'dismiss',
  },
  // ── Экран: home (после запуска варки) ──────────────────────────────────────
  {
    id:         'fermenting_wait',
    screen:     'home',
    emoji:      '🧪',
    title:      'Пиво ферментируется!',
    text:       'Партия запущена. Процесс занимает несколько часов: затирание → варка → брожение → выдержка. Следи за прогрессом на карточках.',
    highlight:  'batch-cards',
    arrow:      'down',
    completeOn: 'dismiss',
  },
  // ── Экран: market ───────────────────────────────────────────────────────────
  {
    id:         'market_intro',
    screen:     'market',
    emoji:      '🏪',
    title:      'Рынок пива',
    text:       'Здесь три вкладки: 🛍️ Магазин — покупай ингредиенты. 📦 Заказы — выполняй заказы клиентов. 💰 Продажа — продавай готовое пиво.',
    highlight:  'market-tabs',
    arrow:      'up',
    completeOn: 'dismiss',
  },
  {
    id:         'market_shop',
    screen:     'market',
    emoji:      '🛍️',
    title:      'Покупай ингредиенты',
    text:       'В Магазине покупай солод, хмель и дрожжи. Стартовый запас уже есть — но скоро закончится. Монеты зарабатываешь продажей пива.',
    highlight:  'shop-tab',
    arrow:      'up',
    completeOn: 'dismiss',
  },
  {
    id:         'market_orders',
    screen:     'market',
    emoji:      '📦',
    title:      'Заказы = бонусы',
    text:       'Клиенты заказывают конкретный стиль пива с требованиями по качеству. Выполни заказ — получи монеты и репутацию. Репутация повышает цену продажи!',
    highlight:  'orders-tab',
    arrow:      'up',
    completeOn: 'dismiss',
  },
  {
    id:         'market_sell',
    screen:     'market',
    emoji:      '💰',
    title:      'Продай готовое пиво',
    text:       'Когда пиво готово — переходи во вкладку "Продажа". Качество влияет на цену: 85+ качество = максимальная наценка!',
    highlight:  'sell-tab',
    arrow:      'up',
    completeOn: 'dismiss',
  },
  // ── Финал ──────────────────────────────────────────────────────────────────
  {
    id:         'tutorial_done',
    screen:     'home',
    emoji:      '🏆',
    title:      'Ты освоил основы!',
    text:       'Теперь ты знаешь как варить, продавать и выполнять заказы. На 2-м уровне откроются новые рецепты. Продолжай варить и прокачиваться!',
    completeOn: 'dismiss',
  },
]

const STORAGE_KEY   = 'beercraft_tutorial_step'
const DISABLED_KEY  = 'beercraft_tutorial_disabled'

export function getTutorialStep(): number {
  if (localStorage.getItem(DISABLED_KEY)) return -1
  const v = localStorage.getItem(STORAGE_KEY)
  return v ? parseInt(v, 10) : 0
}

export function setTutorialStep(step: number) {
  localStorage.setItem(STORAGE_KEY, String(step))
}

export function disableTutorial() {
  localStorage.setItem(DISABLED_KEY, '1')
}

export function isTutorialDone(): boolean {
  if (localStorage.getItem(DISABLED_KEY)) return true
  const step = getTutorialStep()
  return step >= TUTORIAL_STEPS.length
}

export function getTutorialStepForScreen(screen: string): TutorialStep | null {
  if (isTutorialDone()) return null
  const stepIdx = getTutorialStep()
  const step    = TUTORIAL_STEPS[stepIdx]
  if (!step || step.screen !== screen) return null
  return step
}

export function advanceTutorial() {
  const current = getTutorialStep()
  setTutorialStep(current + 1)
}
