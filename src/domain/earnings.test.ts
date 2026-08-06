import { describe, expect, it } from "vitest";
import {
  balanceOfSitter,
  bookingTotalMinor,
  isEmptyBalance,
  earnedTotalMinor,
  earningsByBooking,
  earningsOfBooking,
  lockReasonOf,
  plannedTotalMinor,
} from "./earnings";
import {
  BOOKING_ID,
  CTX,
  TODAY,
  TODAY_EVENING,
  TODAY_MORNING,
  checkedIn,
  closed,
  closedTwoVisits,
  completeVisit,
  confirmed,
  disputed,
  handbackRequested,
  readyToStart,
  requested,
  RATE,
} from "./fixtures";
import { PLATFORM_FEE_RATE, feeMinor, netMinor } from "./money";
import { reduce } from "./reducer";
import { SEED_SITTER_ID } from "./seed";
import { visitId } from "./visits";

describe("возникновение начислений", () => {
  it("начислений нет, пока визиты не завершены", () => {
    expect(earningsOfBooking(readyToStart(), BOOKING_ID)).toHaveLength(0);
  });

  it("отметка прихода сама по себе ничего не начисляет — нужен сданный отчёт", () => {
    expect(earningsOfBooking(checkedIn(), BOOKING_ID)).toHaveLength(0);
  });

  it("на один завершённый визит приходится ровно одно начисление", () => {
    const state = completeVisit(
      readyToStart(),
      visitId(BOOKING_ID, TODAY, "morning"),
    );
    const earnings = earningsOfBooking(state, BOOKING_ID);

    expect(earnings).toHaveLength(1);
    expect(earnings[0]).toMatchObject({
      visitId: visitId(BOOKING_ID, TODAY, "morning"),
    });
  });

  it("два завершённых визита дают два начисления", () => {
    const first = completeVisit(
      readyToStart(),
      visitId(BOOKING_ID, TODAY, "morning"),
    );
    const state = completeVisit(first, visitId(BOOKING_ID, TODAY, "evening"));

    expect(earningsOfBooking(state, BOOKING_ID)).toHaveLength(2);
  });
});

describe("комиссия платформы", () => {
  it("делит сумму визита на комиссию и выплату на руки", () => {
    const state = completeVisit(
      readyToStart(),
      visitId(BOOKING_ID, TODAY, "morning"),
    );
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
    const state = completeVisit(
      readyToStart(),
      visitId(BOOKING_ID, TODAY, "morning"),
    );
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
    const first = completeVisit(
      readyToStart(),
      visitId(BOOKING_ID, TODAY, "morning"),
    );
    const state = completeVisit(first, visitId(BOOKING_ID, TODAY, "evening"));
    const balance = balanceOfSitter(state, SEED_SITTER_ID);

    expect(balance.locked.grossMinor).toBe(2 * RATE);
    expect(balance.locked.items.map((item) => item.slot)).toEqual([
      "morning",
      "evening",
    ]);
  });

  it("пустой баланс — это ни одной из трёх частей, а не только нулевая сумма", () => {
    expect(isEmptyBalance(balanceOfSitter(readyToStart(), SEED_SITTER_ID))).toBe(true);
    expect(isEmptyBalance(balanceOfSitter(closed(), SEED_SITTER_ID))).toBe(false);
  });

  it("выведенного пока нет — вывод появится в тикете 09", () => {
    const state = completeVisit(
      readyToStart(),
      visitId(BOOKING_ID, TODAY, "morning"),
    );

    expect(balanceOfSitter(state, SEED_SITTER_ID).paidOut.count).toBe(0);
  });
});

describe("начислено против плана", () => {
  it("план считается по всем визитам, начислено — только по завершённым", () => {
    const state = completeVisit(
      readyToStart(),
      visitId(BOOKING_ID, TODAY, "morning"),
    );

    expect(plannedTotalMinor(state, BOOKING_ID)).toBe(10 * RATE);
    expect(earnedTotalMinor(state, BOOKING_ID)).toBe(RATE);
  });

  it("отменённые визиты выпадают из плана", () => {
    const cancelled = reduce(
      checkedIn(),
      { type: "BookingCancelled", bookingId: BOOKING_ID },
      CTX,
    );

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

  /**
   * До ответа ситтера визитов ещё нет, но цена уже известна — иначе входящий
   * запрос выглядит бесплатным ровно там, где ситтер решает, брать ли его.
   */
  it("считает стоимость запроса по его датам и слотам, пока визитов нет", () => {
    const state = requested();

    expect(plannedTotalMinor(state, BOOKING_ID)).toBe(0);
    expect(bookingTotalMinor(state, BOOKING_ID)).toBe(10 * RATE);
  });

  it("после принятия считает стоимость по визитам", () => {
    expect(bookingTotalMinor(confirmed(), BOOKING_ID)).toBe(10 * RATE);
  });

  it("у отменённой брони стоимости нет", () => {
    const cancelled = reduce(confirmed(), { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);

    expect(bookingTotalMinor(cancelled, BOOKING_ID)).toBe(0);
  });
});

describe("разбивка по броням", () => {
  it("собирает начисления брони в одну строку с итогом", () => {
    const [row] = earningsByBooking(closedTwoVisits(), SEED_SITTER_ID);

    expect(row.bookingId).toBe(BOOKING_ID);
    expect(row.total.count).toBe(2);
    expect(row.total.grossMinor).toBe(2 * RATE);
    expect(row.items.map((item) => item.visitId)).toEqual([TODAY_MORNING, TODAY_EVENING]);
  });

  it("бронь без начислений в разбивку не попадает — показывать в деньгах нечего", () => {
    expect(earningsByBooking(requested(), SEED_SITTER_ID)).toEqual([]);
    expect(earningsByBooking(readyToStart(), SEED_SITTER_ID)).toEqual([]);
  });

  it("частичный вывод разносит начисления одной брони по разным частям", () => {
    const state = reduce(
      closedTwoVisits(),
      {
        type: "PayoutRequested",
        payoutId: "payout-1",
        sitterId: SEED_SITTER_ID,
        visitIds: [TODAY_MORNING],
      },
      CTX,
    );
    const [row] = earningsByBooking(state, SEED_SITTER_ID);

    expect(row.parts.paidOut.count).toBe(1);
    expect(row.parts.available.count).toBe(1);
    expect(row.parts.locked.count).toBe(0);
    expect(row.total.netMinor).toBe(row.parts.paidOut.netMinor + row.parts.available.netMinor);
  });
});

describe("что удерживает деньги", () => {
  it("у незакрытой брони — подтверждение закрытия семьёй", () => {
    const state = completeVisit(readyToStart(), TODAY_MORNING);

    expect(lockReasonOf(state, BOOKING_ID)).toMatch(/confirms the closing/);
  });

  it("после заявки на сдачу ход за семьёй, и это сказано иначе", () => {
    expect(lockReasonOf(handbackRequested(), BOOKING_ID)).toMatch(/Waiting on the family/);
  });

  /** Обещание «семья подтвердит» для спора неверно: подтверждать уже отказались. */
  it("спор объясняется отдельно", () => {
    expect(lockReasonOf(disputed(), BOOKING_ID)).toMatch(/disputed/);
  });

  it("у закрытой брони удерживать нечего", () => {
    expect(lockReasonOf(closed(), BOOKING_ID)).toBeUndefined();
  });
});
