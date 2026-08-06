import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  balanceOfSitter,
  earningsOfBooking,
  plannedTotalMinor,
} from "./earnings";
import {
  BOOKING_ID,
  CTX,
  NOW,
  TODAY,
  TODAY_EVENING,
  TODAY_MORNING,
  booking,
  closed,
  completeVisit,
  disputed,
  handbackRequested,
  keysReturned,
  lastRejection,
  readyToStart,
  run,
  RATE,
} from "./fixtures";
import { canMarkVisitMissed, canTerminateEarly } from "./guards";
import { handbackSummary } from "./handback";
import { netMinor } from "./money";
import { reduce } from "./reducer";
import { SEED_SITTER_ID } from "./seed";
import type { DomainEvent, DomainState } from "./types";
import { visitId, visitsOfBooking } from "./visits";

const TOMORROW_MORNING = visitId(BOOKING_ID, addDays(TODAY, 1), "morning");

const missed = (id: string, reason?: string): DomainEvent => ({
  type: "VisitMissed",
  visitId: id,
  reason,
});
const terminate = (
  by: "family" | "sitter" = "family",
  reason?: string,
): DomainEvent => ({
  type: "BookingTerminatedEarly",
  bookingId: BOOKING_ID,
  by,
  reason,
});

/** Опека началась: один визит завершён, дальше расходятся сценарии. */
function working(): DomainState {
  return completeVisit(readyToStart(), TODAY_MORNING);
}

function statuses(state: DomainState): Record<string, number> {
  return visitsOfBooking(state, BOOKING_ID).reduce<Record<string, number>>(
    (acc, visit) => {
      acc[visit.status] = (acc[visit.status] ?? 0) + 1;
      return acc;
    },
    {},
  );
}

describe("пропущенный визит", () => {
  it("ситтер отмечает визит не состоявшимся с причиной", () => {
    const state = reduce(
      working(),
      missed(TODAY_EVENING, "Семья вернулась раньше"),
      CTX,
    );
    const visit = state.visits[TODAY_EVENING];

    expect(visit.status).toBe("missed");
    expect(visit.missedReason).toBe("Семья вернулась раньше");
    expect(visit.missedAt).toBe(NOW);
  });

  it("начисления по пропущенному визиту не возникает", () => {
    const state = reduce(working(), missed(TODAY_EVENING), CTX);

    expect(earningsOfBooking(state, BOOKING_ID)).toHaveLength(1);
    expect(balanceOfSitter(state, SEED_SITTER_ID).locked.grossMinor).toBe(RATE);
  });

  it("завершённый визит пропущенным не объявить", () => {
    const state = reduce(working(), missed(TODAY_MORNING), CTX);

    expect(state.visits[TODAY_MORNING].status).toBe("completed");
    expect(lastRejection(state)).toBe(
      "The report is filed — this visit happened",
    );
  });

  it("ошибочно отмеченный приход можно признать пропуском — иначе бронь не закрыть", () => {
    const checkedIn = reduce(
      working(),
      { type: "VisitCheckedIn", visitId: TODAY_EVENING },
      CTX,
    );
    const state = reduce(
      checkedIn,
      missed(TODAY_EVENING, "Не смог приехать"),
      CTX,
    );

    expect(state.visits[TODAY_EVENING]).toMatchObject({
      status: "missed",
      checkedInAt: undefined,
    });
  });

  it("после заявки на сдачу работы отметить пропуск нельзя — сводка уже показана", () => {
    const state = reduce(handbackRequested(), missed(TODAY_EVENING), CTX);

    expect(state.visits[TODAY_EVENING].status).toBe("scheduled");
    expect(lastRejection(state)).toBe(
      "The work has already been submitted for confirmation",
    );
  });

  it("в закрытой броне и в споре пропуск не отметить", () => {
    expect(canMarkVisitMissed(closed(), TODAY_EVENING).allowed).toBe(false);
    expect(canMarkVisitMissed(disputed(), TODAY_EVENING).allowed).toBe(false);
  });
});

describe("досрочное прерывание", () => {
  it("доступно обеим сторонам, пока опека идёт", () => {
    expect(canTerminateEarly(working(), BOOKING_ID).allowed).toBe(true);
  });

  it("до начала опеки бронь просто отменяют", () => {
    const state = reduce(readyToStart(), terminate(), CTX);

    expect(booking(state).status).toBe("readyToStart");
    expect(lastRejection(state)).toBe(
      "Care hasn't started yet — you can simply cancel the booking",
    );
  });

  it("фиксирует, кто прервал и почему", () => {
    const state = reduce(working(), terminate("sitter", "Заболел"), CTX);

    expect(booking(state)).toMatchObject({
      status: "terminatedEarly",
      terminatedBy: "sitter",
      terminationReason: "Заболел",
      terminatedAt: NOW,
    });
  });

  it("оставшиеся запланированные визиты перестают быть актуальными", () => {
    const state = reduce(working(), terminate(), CTX);

    expect(state.visits[TOMORROW_MORNING].status).toBe("cancelled");
    expect(statuses(state)).toEqual({ completed: 1, cancelled: 9 });
  });

  it("не трогает уже завершённые и пропущенные визиты", () => {
    const withMissed = reduce(working(), missed(TODAY_EVENING), CTX);
    const state = reduce(withMissed, terminate(), CTX);

    expect(statuses(state)).toEqual({ completed: 1, missed: 1, cancelled: 8 });
  });

  it("повторное прерывание отклоняется", () => {
    const state = reduce(reduce(working(), terminate(), CTX), terminate(), CTX);

    expect(lastRejection(state)).toBe("Care has already been ended early");
  });
});

describe("прерванная бронь закрывается тем же путём", () => {
  /** Прерывание, возврат ключей, сдача работы, подтверждение семьи. */
  function terminatedAndClosed(): DomainState {
    const terminated = reduce(
      working(),
      terminate("family", "Вернулись раньше"),
      CTX,
    );
    return run(
      [
        { type: "HandbackRequested", bookingId: BOOKING_ID },
        { type: "HandbackConfirmed", bookingId: BOOKING_ID },
      ],
      keysReturned(terminated),
    );
  }

  it("ключи возвращают и в прерванной опеке", () => {
    const terminated = reduce(working(), terminate(), CTX);
    const state = keysReturned(terminated);

    expect(booking(state).keys.return.status).toBe("done");
  });

  it("сдача работы и подтверждение закрывают бронь", () => {
    const state = terminatedAndClosed();

    expect(booking(state).status).toBe("completed");
    expect(booking(state).closedBy).toBe("family");
  });

  it("начисление идёт по завершённым визитам, а не по плану периода — инвариант 7", () => {
    const state = terminatedAndClosed();
    const balance = balanceOfSitter(state, SEED_SITTER_ID);

    expect(earningsOfBooking(state, BOOKING_ID)).toHaveLength(1);
    expect(balance.available.grossMinor).toBe(1 * RATE);
    expect(balance.available.netMinor).toBe(netMinor(RATE));
    // Отменённые визиты уходят и из плана: от них отказались.
    expect(plannedTotalMinor(state, BOOKING_ID)).toBe(1 * RATE);
  });

  it("сумма прерванной брони равна ставке × число завершённых визитов", () => {
    const twoDone = completeVisit(working(), TODAY_EVENING);
    const terminated = reduce(twoDone, terminate(), CTX);
    const state = run(
      [
        { type: "HandbackRequested", bookingId: BOOKING_ID },
        { type: "HandbackConfirmed", bookingId: BOOKING_ID },
      ],
      keysReturned(terminated),
    );

    expect(balanceOfSitter(state, SEED_SITTER_ID).available.grossMinor).toBe(
      2 * RATE,
    );
  });
});

describe("сводка закрытия", () => {
  it("показывает пропущенные и отменённые отдельно от выполненных", () => {
    const withMissed = reduce(working(), missed(TODAY_EVENING), CTX);
    const state = reduce(withMissed, terminate(), CTX);

    expect(handbackSummary(state, BOOKING_ID)).toMatchObject({
      planned: 10,
      completed: 1,
      missed: 1,
      cancelled: 8,
      unaccounted: 0,
      grossMinor: RATE,
    });
  });

  it("визиты без отметки считаются отдельно от пропущенных", () => {
    expect(handbackSummary(working(), BOOKING_ID)).toMatchObject({
      completed: 1,
      missed: 0,
      cancelled: 0,
      unaccounted: 9,
    });
  });
});
