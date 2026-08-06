import { describe, expect, it } from "vitest";
import { addDays, today } from "./dates";
import { balanceOfSitter, earningsOfBooking, plannedTotalMinor } from "./earnings";
import {
  BOOKING_ID,
  CTX,
  NOW,
  TODAY,
  TODAY_MORNING,
  booking,
  closed,
  completeVisit,
  handbackRequested,
  keysReturned,
  lastRejection,
  readyToStart,
  workDone,
} from "./fixtures";
import { canCancelBooking, canCheckIn, canRequestHandback } from "./guards";
import { handbackSummary } from "./handback";
import { netMinor } from "./money";
import { reduce } from "./reducer";
import { SEED_SITTER_ID } from "./seed";
import type { DomainEvent } from "./types";
import { visitId } from "./visits";

const RATE = 70_000;
const request: DomainEvent = { type: "HandbackRequested", bookingId: BOOKING_ID };
const confirm: DomainEvent = { type: "HandbackConfirmed", bookingId: BOOKING_ID };

describe("заявка на сдачу работы", () => {
  it("невозможна, пока опека не началась", () => {
    const state = reduce(readyToStart(), request, CTX);

    expect(booking(state).status).toBe("readyToStart");
    expect(lastRejection(state)).toContain("Опека ещё не началась");
  });

  it("невозможна, пока ключи не возвращены обеими сторонами", () => {
    const worked = completeVisit(readyToStart(), TODAY_MORNING);
    const state = reduce(worked, request, CTX);

    expect(booking(state).status).toBe("inProgress");
    expect(lastRejection(state)).toBe("Возврат ключей не подтверждён обеими сторонами");
  });

  it("одного подтверждения возврата ключей недостаточно", () => {
    const worked = completeVisit(readyToStart(), TODAY_MORNING);
    const proposed = reduce(
      worked,
      {
        type: "KeyHandoverProposed",
        bookingId: BOOKING_ID,
        direction: "return",
        by: "sitter",
        method: "inPerson",
        meetingAt: NOW,
      },
      CTX,
    );

    expect(booking(proposed).keys.return.status).toBe("proposed");
    expect(canRequestHandback(proposed, BOOKING_ID).allowed).toBe(false);
  });

  it("невозможна, пока есть визит с отмеченным приходом без отчёта", () => {
    const started = reduce(readyToStart(), { type: "VisitCheckedIn", visitId: TODAY_MORNING }, CTX);
    const state = reduce(keysReturned(started), request, CTX);

    expect(booking(state).status).toBe("inProgress");
    expect(lastRejection(state)).toContain("Закройте визит, где отмечен приход");
  });

  it("переводит бронь в ожидание подтверждения семьи", () => {
    const state = handbackRequested();

    expect(booking(state).status).toBe("awaitingHandback");
    expect(booking(state).handbackRequestedAt).toBe(NOW);
  });

  it("деньги остаются заблокированными, пока семья не подтвердила", () => {
    const balance = balanceOfSitter(handbackRequested(), SEED_SITTER_ID);

    expect(balance.locked.netMinor).toBe(netMinor(RATE));
    expect(balance.available.netMinor).toBe(0);
  });

  it("повторная заявка отклоняется", () => {
    const state = reduce(handbackRequested(), request, CTX);

    expect(lastRejection(state)).toBe("Заявка уже отправлена — ждём подтверждения семьи");
  });
});

describe("подтверждение закрытия", () => {
  it("невозможно, пока ситтер не заявил сдачу работы", () => {
    const state = reduce(workDone(), confirm, CTX);

    expect(booking(state).status).toBe("inProgress");
    expect(lastRejection(state)).toBe("Ситтер ещё не заявил сдачу работы");
  });

  it("закрывает бронь", () => {
    const state = closed();

    expect(booking(state).status).toBe("completed");
    expect(booking(state).completedAt).toBe(NOW);
  });

  it("разблокирует деньги ситтера — инвариант 4", () => {
    const balance = balanceOfSitter(closed(), SEED_SITTER_ID);

    expect(balance.locked.count).toBe(0);
    expect(balance.available.count).toBe(1);
    expect(balance.available.netMinor).toBe(netMinor(RATE));
  });

  it("платит только за состоявшиеся визиты, а не по плану периода", () => {
    const state = closed();

    expect(plannedTotalMinor(state, BOOKING_ID)).toBe(10 * RATE);
    expect(earningsOfBooking(state, BOOKING_ID)).toHaveLength(1);
    expect(balanceOfSitter(state, SEED_SITTER_ID).available.grossMinor).toBe(RATE);
  });

  it("повторное подтверждение отклоняется", () => {
    const state = reduce(closed(), confirm, CTX);

    expect(lastRejection(state)).toBe("Бронь уже закрыта");
  });
});

describe("набор начислений после заявки не меняется", () => {
  it("приход на визит отметить уже нельзя", () => {
    const state = handbackRequested();
    const next = visitId(BOOKING_ID, today(NOW), "evening");
    const guard = canCheckIn(state, next, NOW);

    expect(guard).toEqual({
      allowed: false,
      reason: "Работа сдана на подтверждение — ключи уже возвращены",
    });
  });

  it("у закрытой брони приход тоже недоступен", () => {
    const later = visitId(BOOKING_ID, addDays(TODAY, 1), "morning");

    expect(canCheckIn(closed(), later, NOW)).toEqual({ allowed: false, reason: "Опека закрыта" });
  });
});

describe("сводка для семьи", () => {
  it("показывает состоявшиеся, несостоявшиеся визиты и итоговую сумму", () => {
    expect(handbackSummary(handbackRequested(), BOOKING_ID)).toMatchObject({
      planned: 10,
      completed: 1,
      unaccounted: 9,
      grossMinor: RATE,
      netMinor: netMinor(RATE),
    });
  });

  it("считает каждый завершённый визит", () => {
    const twice = completeVisit(
      completeVisit(readyToStart(), TODAY_MORNING),
      visitId(BOOKING_ID, TODAY, "evening"),
    );

    expect(handbackSummary(twice, BOOKING_ID)).toMatchObject({
      completed: 2,
      unaccounted: 8,
      grossMinor: 2 * RATE,
    });
  });
});

describe("отмена брони на закрытии", () => {
  it("бронь на подтверждении отменить нельзя — нужно досрочное прерывание", () => {
    expect(canCancelBooking(handbackRequested(), BOOKING_ID)).toEqual({
      allowed: false,
      reason: "Опека уже началась — нужно досрочное прерывание",
    });
  });

  it("закрытую бронь отменять нечего", () => {
    expect(canCancelBooking(closed(), BOOKING_ID)).toEqual({
      allowed: false,
      reason: "Опека закрыта — отменять нечего",
    });
  });
});
