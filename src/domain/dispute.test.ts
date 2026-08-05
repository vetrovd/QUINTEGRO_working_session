import { describe, expect, it } from "vitest";
import { HOUR_MS } from "./clock";
import { balanceOfSitter } from "./earnings";
import {
  BOOKING_ID,
  CTX,
  NOW,
  TODAY_EVENING,
  TODAY_MORNING,
  booking,
  closed,
  disputed,
  handbackRequested,
  lastRejection,
  workDone,
} from "./fixtures";
import { DISPUTE_DEAD_END, canDisputeHandback, canRequestPayout } from "./guards";
import { HANDBACK_WINDOW_HOURS, expiredHandbacks, handbackDeadline } from "./handback";
import { netMinor } from "./money";
import { reduce } from "./reducer";
import { SEED_SITTER_ID } from "./seed";
import type { DomainEvent } from "./types";

const RATE = 70_000;
const REASON = "Лоток не убран, воды нет";
const dispute = (reason = REASON): DomainEvent => ({
  type: "HandbackDisputed",
  bookingId: BOOKING_ID,
  reason,
});
const later = { now: new Date(Date.parse(NOW) + 100 * HOUR_MS).toISOString() };

describe("семья оспаривает закрытие", () => {
  it("оспорить можно только заявленную сдачу работы", () => {
    const state = reduce(workDone(), dispute(), CTX);

    expect(booking(state).status).toBe("inProgress");
    expect(lastRejection(state)).toBe("Ситтер ещё не заявил сдачу работы");
  });

  it("спор без причины отклоняется — разбирать было бы нечего", () => {
    const state = reduce(handbackRequested(), dispute("   "), CTX);

    expect(booking(state).status).toBe("awaitingHandback");
    expect(lastRejection(state)).toBe("Опишите, что пошло не так");
  });

  it("спор фиксирует причину и время", () => {
    const state = disputed();

    expect(booking(state).status).toBe("disputed");
    expect(booking(state).disputeReason).toBe(REASON);
    expect(booking(state).disputedAt).toBe(NOW);
  });

  it("закрытую бронь оспорить уже нельзя", () => {
    const state = reduce(closed(), dispute(), CTX);

    expect(booking(state).status).toBe("completed");
    expect(lastRejection(state)).toBe("Бронь уже закрыта");
  });
});

describe("спор не двигает деньги", () => {
  it("начисления остаются заблокированными, доступного нет", () => {
    const balance = balanceOfSitter(disputed(), SEED_SITTER_ID);

    expect(balance.locked.netMinor).toBe(netMinor(RATE));
    expect(balance.available.count).toBe(0);
    expect(balance.paidOut.count).toBe(0);
  });

  it("вывести заблокированное нельзя", () => {
    const guard = canRequestPayout(disputed(), SEED_SITTER_ID, [TODAY_MORNING]);

    expect(guard).toEqual({
      allowed: false,
      reason: "Деньги за визит заблокированы — семья не подтвердила закрытие брони",
    });
  });
});

describe("таймаут в споре не срабатывает", () => {
  it("у брони в споре нет дедлайна", () => {
    expect(handbackDeadline(booking(disputed()))).toBeUndefined();
    expect(expiredHandbacks(disputed(), later.now)).toEqual([]);
  });

  it("авто-подтверждение после спора отклоняется", () => {
    const state = reduce(disputed(), { type: "HandbackAutoConfirmed", bookingId: BOOKING_ID }, later);

    expect(booking(state).status).toBe("disputed");
    expect(lastRejection(state)).toBe(DISPUTE_DEAD_END);
  });

  it("спор внутри окна ответа обгоняет таймаут", () => {
    const inWindow = { now: new Date(Date.parse(NOW) + (HANDBACK_WINDOW_HOURS - 1) * HOUR_MS).toISOString() };
    const state = reduce(handbackRequested(), dispute(), inWindow);

    expect(booking(state).status).toBe("disputed");
    expect(expiredHandbacks(state, later.now)).toEqual([]);
  });
});

describe("из спора нет переходов", () => {
  const events: DomainEvent[] = [
    { type: "HandbackConfirmed", bookingId: BOOKING_ID },
    { type: "HandbackRequested", bookingId: BOOKING_ID },
    { type: "BookingCancelled", bookingId: BOOKING_ID },
    // Ещё не состоявшийся визит: у завершённого сработал бы отказ уровня визита.
    { type: "VisitCheckedIn", visitId: TODAY_EVENING },
    { type: "HandbackDisputed", bookingId: BOOKING_ID, reason: "И ещё вот это" },
  ];

  for (const event of events) {
    it(`${event.type} отклоняется с объяснением тупика`, () => {
      const state = reduce(disputed(), event, later);

      expect(booking(state).status).toBe("disputed");
      expect(lastRejection(state)).toBe(DISPUTE_DEAD_END);
    });
  }

  it("guard спора тоже сообщает о тупике, а не о чём-то другом", () => {
    expect(canDisputeHandback(disputed(), BOOKING_ID, REASON)).toEqual({
      allowed: false,
      reason: DISPUTE_DEAD_END,
    });
  });
});
