import { describe, expect, it } from "vitest";
import { HOUR_MS } from "./clock";
import { balanceOfSitter } from "./earnings";
import {
  BOOKING_ID,
  CTX,
  NOW,
  booking,
  closed,
  handbackRequested,
  lastRejection,
  workDone,
} from "./fixtures";
import { canAutoConfirmHandback } from "./guards";
import {
  HANDBACK_WINDOW_HOURS,
  expiredHandbacks,
  handbackDeadline,
  handbackTimeLeftMs,
} from "./handback";
import { netMinor } from "./money";
import type { ReduceContext } from "./reducer";
import { reduce } from "./reducer";
import { SEED_SITTER_ID } from "./seed";
import type { DomainEvent, DomainState } from "./types";

const RATE = 70_000;
const autoConfirm: DomainEvent = { type: "HandbackAutoConfirmed", bookingId: BOOKING_ID };

/** Контекст со временем, сдвинутым от заявки на указанное число часов. */
function after(hours: number, extraMs = 0): ReduceContext {
  return { now: new Date(Date.parse(NOW) + hours * HOUR_MS + extraMs).toISOString() };
}

function timeLeft(state: DomainState, ctx: ReduceContext): number {
  return handbackTimeLeftMs(booking(state), ctx.now);
}

describe("окно ответа семьи", () => {
  it("считается от заявки на сдачу работы", () => {
    const state = handbackRequested();

    expect(handbackDeadline(booking(state))).toBe(after(HANDBACK_WINDOW_HOURS).now);
  });

  it("есть только у брони, ожидающей подтверждения", () => {
    expect(handbackDeadline(booking(workDone()))).toBeUndefined();
    expect(handbackDeadline(booking(closed()))).toBeUndefined();
  });

  it("остаток уменьшается по мере хода времени и не уходит в минус", () => {
    const state = handbackRequested();

    expect(timeLeft(state, CTX)).toBe(HANDBACK_WINDOW_HOURS * HOUR_MS);
    expect(timeLeft(state, after(47))).toBe(HOUR_MS);
    expect(timeLeft(state, after(100))).toBe(0);
  });
});

describe("авто-подтверждение по таймауту", () => {
  it("за минуту до истечения окна бронь не закрывается", () => {
    const ctx = after(HANDBACK_WINDOW_HOURS, -60_000);
    const state = reduce(handbackRequested(), autoConfirm, ctx);

    expect(booking(state).status).toBe("awaitingHandback");
    expect(lastRejection(state)).toBe("Окно ответа семьи ещё не истекло");
    expect(expiredHandbacks(handbackRequested(), ctx.now)).toEqual([]);
  });

  it("ровно по истечении 48 часов бронь закрывается без участия семьи", () => {
    const ctx = after(HANDBACK_WINDOW_HOURS);
    const state = reduce(handbackRequested(), autoConfirm, ctx);

    expect(booking(state).status).toBe("completed");
    expect(booking(state).closedBy).toBe("timeout");
    expect(booking(state).completedAt).toBe(ctx.now);
  });

  it("деньги разблокируются так же, как при подтверждении семьи", () => {
    const state = reduce(handbackRequested(), autoConfirm, after(HANDBACK_WINDOW_HOURS));
    const balance = balanceOfSitter(state, SEED_SITTER_ID);

    expect(balance.locked.count).toBe(0);
    expect(balance.available.netMinor).toBe(netMinor(RATE));
  });

  it("просроченная бронь попадает в список к закрытию", () => {
    const state = handbackRequested();

    expect(expiredHandbacks(state, after(HANDBACK_WINDOW_HOURS).now)).toEqual([BOOKING_ID]);
  });
});

describe("ручное подтверждение имеет приоритет", () => {
  it("подтверждение внутри окна отменяет срабатывание таймаута", () => {
    const confirmed = closed();

    expect(booking(confirmed).closedBy).toBe("family");
    expect(expiredHandbacks(confirmed, after(100).now)).toEqual([]);
  });

  it("после ручного подтверждения авто-подтверждение отклоняется", () => {
    const state = reduce(closed(), autoConfirm, after(100));

    expect(booking(state).closedBy).toBe("family");
    expect(lastRejection(state)).toBe("Бронь уже закрыта");
  });

  it("бронь без заявки на сдачу таймаут не закрывает", () => {
    const state = reduce(workDone(), autoConfirm, after(100));

    expect(booking(state).status).toBe("inProgress");
    expect(lastRejection(state)).toBe("Ситтер ещё не заявил сдачу работы");
    expect(canAutoConfirmHandback(workDone(), BOOKING_ID, after(100).now).allowed).toBe(false);
  });
});
