import { describe, expect, it } from "vitest";
import { balanceOfSitter } from "./earnings";
import type { Balance, EarningStatus } from "./earnings";
import {
  BOOKING_ID,
  CTX,
  NOW,
  TODAY_EVENING,
  TODAY_MORNING,
  closed,
  closedTwoVisits,
  handbackRequested,
  lastRejection,
  run,
} from "./fixtures";
import { canRequestPayout } from "./guards";
import { netMinor } from "./money";
import { payoutsOfSitter } from "./payouts";
import { reduce } from "./reducer";
import { SEED_SITTER_ID } from "./seed";
import type { DomainEvent, DomainState } from "./types";

const RATE = 2_000;

const payout = (visitIds: string[], payoutId = "payout-1"): DomainEvent => ({
  type: "PayoutRequested",
  payoutId,
  sitterId: SEED_SITTER_ID,
  visitIds,
});

function balance(state: DomainState): Balance {
  return balanceOfSitter(state, SEED_SITTER_ID);
}

/** Сумма всех частей баланса: вывод её не меняет, только перекладывает. */
function totalNet(state: DomainState): number {
  const parts = balance(state);
  const statuses: EarningStatus[] = ["locked", "available", "paidOut"];
  return statuses.reduce((sum, status) => sum + parts[status].netMinor, 0);
}

describe("вывод заработанного", () => {
  it("выводит всю доступную сумму", () => {
    const before = closedTwoVisits();
    const state = reduce(before, payout([TODAY_MORNING, TODAY_EVENING]), CTX);

    expect(balance(state).available.count).toBe(0);
    expect(balance(state).paidOut.count).toBe(2);
    expect(balance(state).paidOut.netMinor).toBe(2 * netMinor(RATE));
  });

  it("выводит часть — остальное остаётся доступным", () => {
    const state = reduce(closedTwoVisits(), payout([TODAY_MORNING]), CTX);

    expect(balance(state).paidOut.count).toBe(1);
    expect(balance(state).available.count).toBe(1);
    expect(balance(state).available.items[0].visitId).toBe(TODAY_EVENING);
  });

  it("не меняет сумму баланса, только перекладывает между частями", () => {
    const before = closedTwoVisits();
    const state = reduce(before, payout([TODAY_MORNING]), CTX);

    expect(totalNet(state)).toBe(totalNet(before));
    expect(totalNet(state)).toBe(2 * netMinor(RATE));
  });

  it("остаток можно вывести вторым выводом", () => {
    const first = reduce(closedTwoVisits(), payout([TODAY_MORNING]), CTX);
    const state = reduce(first, payout([TODAY_EVENING], "payout-2"), CTX);

    expect(balance(state).available.count).toBe(0);
    expect(payoutsOfSitter(state, SEED_SITTER_ID)).toHaveLength(2);
  });
});

describe("вывести больше доступного нельзя — инвариант 5", () => {
  it("заблокированные деньги не выводятся", () => {
    const state = reduce(handbackRequested(), payout([TODAY_MORNING]), CTX);

    expect(balance(state).paidOut.count).toBe(0);
    expect(lastRejection(state)).toBe(
      "This visit's money is locked — the family hasn't confirmed closing",
    );
  });

  it("один и тот же визит нельзя вывести дважды", () => {
    const first = reduce(closedTwoVisits(), payout([TODAY_MORNING]), CTX);
    const state = reduce(first, payout([TODAY_MORNING], "payout-2"), CTX);

    expect(balance(state).paidOut.count).toBe(1);
    expect(lastRejection(state)).toBe("This visit's money is already cashed out");
  });

  it("визит нельзя удвоить внутри одного вывода", () => {
    const state = reduce(closedTwoVisits(), payout([TODAY_MORNING, TODAY_MORNING]), CTX);

    expect(Object.keys(state.payouts)).toHaveLength(0);
    expect(lastRejection(state)).toBe("A visit is listed twice");
  });

  it("визит без начисления не выводится", () => {
    const state = reduce(closed(), payout([TODAY_EVENING]), CTX);

    expect(lastRejection(state)).toBe("This visit has no earning");
  });

  it("пустой вывод отклоняется", () => {
    const state = reduce(closedTwoVisits(), payout([]), CTX);

    expect(lastRejection(state)).toBe("Pick visits to cash out");
  });

  it("чужое начисление не выводится", () => {
    const guard = canRequestPayout(closedTwoVisits(), "sitter-2", [TODAY_MORNING]);

    expect(guard).toEqual({ allowed: false, reason: "This earning belongs to another sitter" });
  });

  it("повторное событие с тем же идентификатором вывода отклоняется", () => {
    const state = run([payout([TODAY_MORNING]), payout([TODAY_EVENING])], closedTwoVisits());

    expect(Object.keys(state.payouts)).toHaveLength(1);
    expect(lastRejection(state)).toBe("Вывод с таким идентификатором уже существует");
  });
});

describe("история выводов", () => {
  it("показывает дату, сумму и вошедшие визиты", () => {
    const state = reduce(closedTwoVisits(), payout([TODAY_MORNING, TODAY_EVENING]), CTX);
    const [record] = payoutsOfSitter(state, SEED_SITTER_ID);

    expect(record.paidAt).toBe(NOW);
    expect(record.grossMinor).toBe(2 * RATE);
    expect(record.netMinor).toBe(2 * netMinor(RATE));
    expect(record.earnings.map((earning) => earning.visitId)).toEqual([
      TODAY_MORNING,
      TODAY_EVENING,
    ]);
  });

  it("вывод не трогает визиты и отчёты — начисления остаются теми же", () => {
    const before = closedTwoVisits();
    const state = reduce(before, payout([TODAY_MORNING]), CTX);

    expect(state.visits).toEqual(before.visits);
    expect(state.reports).toEqual(before.reports);
    expect(state.bookings[BOOKING_ID]).toEqual(before.bookings[BOOKING_ID]);
  });
});
