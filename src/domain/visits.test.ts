import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { BOOKING_ID, CTX, TODAY, bookingRequested, confirmed, requested, run } from "./fixtures";
import { reduce } from "./reducer";
import { visitsOfBooking } from "./visits";

describe("разворачивание периода в визиты", () => {
  it("не создаёт визиты, пока ситтер не принял бронь", () => {
    expect(visitsOfBooking(requested(), BOOKING_ID)).toHaveLength(0);
  });

  it("создаёт визит на каждый слот каждого дня периода", () => {
    const visits = visitsOfBooking(confirmed(), BOOKING_ID);

    // 5 дней × 2 слота
    expect(visits).toHaveLength(10);
    expect(visits.every((visit) => visit.status === "scheduled")).toBe(true);
  });

  it("выдаёт визиты в хронологическом порядке, слоты — по времени дня", () => {
    const visits = visitsOfBooking(confirmed(), BOOKING_ID);

    expect(visits.slice(0, 3).map((visit) => [visit.date, visit.slot])).toEqual([
      [TODAY, "morning"],
      [TODAY, "evening"],
      [addDays(TODAY, 1), "morning"],
    ]);
  });

  it("сохраняет порядок слотов по времени дня, даже если в брони они перечислены иначе", () => {
    const state = run([
      { ...bookingRequested, slots: ["evening", "morning", "midday"] },
      { type: "BookingAccepted", bookingId: BOOKING_ID },
    ]);

    expect(visitsOfBooking(state, BOOKING_ID).slice(0, 3).map((visit) => visit.slot)).toEqual([
      "morning",
      "midday",
      "evening",
    ]);
  });

  it("даёт визитам предсказуемые идентификаторы — редьюсер остаётся чистым", () => {
    const first = visitsOfBooking(confirmed(), BOOKING_ID);
    const second = visitsOfBooking(confirmed(), BOOKING_ID);

    expect(first.map((visit) => visit.id)).toEqual(second.map((visit) => visit.id));
    expect(first[0].id).toBe(`${BOOKING_ID}:${TODAY}:morning`);
  });

  it("период из одного дня даёт по визиту на слот", () => {
    const state = run([
      { ...bookingRequested, endDate: TODAY, slots: ["midday"] },
      { type: "BookingAccepted", bookingId: BOOKING_ID },
    ]);

    expect(visitsOfBooking(state, BOOKING_ID)).toHaveLength(1);
  });

  it("отмена брони отменяет её запланированные визиты", () => {
    const state = reduce(confirmed(), { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);

    expect(visitsOfBooking(state, BOOKING_ID).every((visit) => visit.status === "cancelled")).toBe(
      true,
    );
  });
});
