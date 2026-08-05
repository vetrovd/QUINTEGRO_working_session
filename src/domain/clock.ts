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
