/**
 * Детерминированный PRNG на основе seed матча.
 *
 * Алгоритм: mulberry32 — быстрый, малый, достаточно хорошего качества для игры.
 * Одинаковый seed → одинаковая последовательность у всех игроков.
 * Используется для: дрейфа температуры в мини-игре, случайного разброса качества,
 * параметров задания.
 *
 * Клиент инициализирует своё локальное PRNG тем же seed — результаты совпадают.
 * Сервер независимо воспроизводит ту же последовательность для валидации.
 */

export class SeededRandom {
  private state: number

  constructor(seed: bigint | number) {
    // mulberry32 принимает 32-bit uint
    this.state = Number(BigInt(seed) & BigInt(0xFFFFFFFF))
    // Прогреваем генератор (первые значения хуже у некоторых сидов)
    this.next()
    this.next()
  }

  /** Возвращает следующее float в диапазоне [0, 1) */
  next(): number {
    this.state |= 0
    this.state = this.state + 0x6D2B79F5 | 0
    let z = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    z = z + Math.imul(z ^ (z >>> 7), 61 | z) ^ z
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }

  /** float в диапазоне [min, max) */
  float(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Целое в диапазоне [min, max] включительно */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1))
  }

  /** Выбрать случайный элемент массива */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)]
  }

  /**
   * Генерирует последовательность «дрейфа» температуры для мини-игры.
   * steps — количество тиков, amplitude — максимальное отклонение за тик.
   * Клиент использует ту же последовательность для анимации.
   */
  driftSequence(steps: number, amplitude = 1.0): number[] {
    return Array.from({ length: steps }, () =>
      this.float(-amplitude, amplitude),
    )
  }
}

/**
 * Фабрика: создаёт PRNG для конкретного матча и этапа.
 * Разные этапы получают разные подпоследовательности от одного seed.
 *
 * stage: 'mash' | 'hops' | 'chill' — чтобы у каждого этапа был свой дрейф.
 */
export function makeMatchRng(seed: bigint, stage: 'mash' | 'hops' | 'chill'): SeededRandom {
  const stageSalt: Record<string, bigint> = {
    mash:  BigInt(1_000_003),
    hops:  BigInt(2_000_003),
    chill: BigInt(3_000_003),
  }
  return new SeededRandom(seed ^ (stageSalt[stage] ?? BigInt(1)))
}
