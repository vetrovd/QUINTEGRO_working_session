import { describe, expect, it } from "vitest";
import {
  balanceOfSitter,
  earnedTotalMinor,
  earningsOfBooking,
  plannedTotalMinor,
} from "./earnings";
import {
  BOOKING_ID,
  CTX,
  TODAY,
  checkedIn,
  closed,
  completeVisit,
  readyToStart,
} from "./fixtures";
import { PLATFORM_FEE_RATE, feeMinor, netMinor } from "./money";
import { reduce } from "./reducer";
import { SEED_SITTER_ID } from "./seed";
import { visitId } from "./visits";

const RATE = 70_000;

describe("возникновение начислений", () => {
  it("начислений нет, пока визиты не завершены", () => {
    expect(earningsOfBooking(readyToStart(), BOOKING_ID)).toHaveLength(0);
  });

  it("отметка прихода сама по себе ничего не начисляет — нужен сданный отчёт", () => {
    expect(earningsOfBooking(checkedIn(), BOOKING_ID)).toHaveLength(0);
  });

  it("на один завершённый визит приходится ровно одно начисление", () => {
    const state = completeVisit(readyToStart(), visitId(BOOKING_ID, TODAY, "morning"));
    const earnings = earningsOfBooking(state, BOOKING_ID);

    expect(earnings).toHaveLength(1);
    expect(earnings[0]).toMatchObject({ visitId: visitId(BOOKING_ID, TODAY, "morning") });
  });

  it("два завершённых визита дают два начисления", () => {
    const first = completeVisit(readyToStart(), visitId(BOOKING_ID, TODAY, "morning"));
    const state = completeVisit(first, visitId(BOOKING_ID, TODAY, "evening"));

    expect(earningsOfBooking(state, BOOKING_ID)).toHaveLength(2);
  });
});

describe("комиссия платформы", () => {
  it("делит сумму визита на комиссию и выплату на руки", () => {
    const state = completeVisit(readyToStart(), visitId(BOOKING_ID, TODAY, "morning"));
    const [earning] = earningsOfBooking(state, BOOKING_ID);

    expect(earning.grossMinor).toBe(RATE);
    expect(earning.feeMinor).toBe(RATE * PLATFORM_FEE_RATE);
    expect(earning.netMinor).toBe(RATE - earning.feeMinor);
  });

  it("комиссия и выплата всегда дают исходную сумму, без потерь на округлении", () => {
    for (const gross of [1, 7, 33, 12_345, 99_999]) {
      expect(feeMinor(gross) + netMinor(gross)).toBe(gross);
    }
  });
});

describe("баланс", () => {
  it("у незакрытой брони всё заблокировано, доступного нет", () => {
    const state = completeVisit(readyToStart(), visitId(BOOKING_ID, TODAY, "morning"));
    const balance = balanceOfSitter(state, SEED_SITTER_ID);

    expect(balance.locked.count).toBe(1);
    expect(balance.locked.grossMinor).toBe(RATE);
    expect(balance.available.count).toBe(0);
    expect(balance.available.netMinor).toBe(0);
  });

  it("закрытие брони переводит начисления в доступные", () => {
    const balance = balanceOfSitter(closed(), SEED_SITTER_ID);

    expect(balance.locked.count).toBe(0);
    expect(balance.available.count).toBe(1);
    expect(balance.available.netMinor).toBe(netMinor(RATE));
  });

  it("суммы частей складываются из отдельных визитов", () => {
    const first = completeVisit(readyToStart(), visitId(BOOKING_ID, TODAY, "morning"));
    const state = completeVisit(first, visitId(BOOKING_ID, TODAY, "evening"));
    const balance = balanceOfSitter(state, SEED_SITTER_ID);

    expect(balance.locked.grossMinor).toBe(2 * RATE);
    expect(balance.locked.items.map((item) => item.slot)).toEqual(["morning", "evening"]);
  });

  it("выведенного пока нет — вывод появится в тикете 09", () => {
    const state = completeVisit(readyToStart(), visitId(BOOKING_ID, TODAY, "morning"));

    expect(balanceOfSitter(state, SEED_SITTER_ID).paidOut.count).toBe(0);
  });
});

describe("начислено против плана", () => {
  it("план считается по всем визитам, начислено — только по завершённым", () => {
    const state = completeVisit(readyToStart(), visitId(BOOKING_ID, TODAY, "morning"));

    expect(plannedTotalMinor(state, BOOKING_ID)).toBe(10 * RATE);
    expect(earnedTotalMinor(state, BOOKING_ID)).toBe(RATE);
  });

  it("отменённые визиты выпадают из плана", () => {
    const cancelled = reduce(checkedIn(), { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);

    // Опека уже началась — отмена брони отклонена, план не изменился.
    expect(plannedTotalMinor(cancelled, BOOKING_ID)).toBe(10 * RATE);

    const beforeStart = reduce(
      readyToStart(),
      { type: "BookingCancelled", bookingId: BOOKING_ID },
      CTX,
    );

    expect(plannedTotalMinor(beforeStart, BOOKING_ID)).toBe(0);
    expect(earnedTotalMinor(beforeStart, BOOKING_ID)).toBe(0);
  });
});
