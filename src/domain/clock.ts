import type { IsoDateTime } from "./types";

/**
 * Часы — зависимость домена, а не глобальный Date.now(). Без этого
 * 48-часовое окно подтверждения Handback'а (ADR 0001, тикет 10) нечем
 * протестировать и нечем показать в демонстрации.
 */
export interface Clock {
  now(): IsoDateTime;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

export const HOUR_MS = 60 * 60 * 1000;

export interface ShiftingClock extends Clock {
  advance(hours: number): void;
  reset(): void;
  offsetMs(): number;
}

/**
 * Часы прототипа: настоящее время плюс сдвиг, который двигает панель. Нужны,
 * чтобы 48-часовое окно подтверждения можно было показать, а не рассказать.
 */
export function shiftingClock(base: Clock = systemClock, initialOffsetMs = 0): ShiftingClock {
  let offset = initialOffsetMs;
  return {
    now: () => new Date(Date.parse(base.now()) + offset).toISOString(),
    advance: (hours) => {
      offset += hours * HOUR_MS;
    },
    reset: () => {
      offset = 0;
    },
    offsetMs: () => offset,
  };
}

/** Часы для тестов: время не двигается, пока его не сдвинут явно. */
export function fixedClock(start: IsoDateTime): Clock & { advanceHours(hours: number): void } {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current).toISOString(),
    advanceHours(hours) {
      current += hours * 60 * 60 * 1000;
    },
  };
}
