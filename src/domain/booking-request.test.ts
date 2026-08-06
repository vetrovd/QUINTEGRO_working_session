import { describe, expect, it } from "vitest";
import { busyDates } from "./availability";
import { canStartCare, canRequestBooking } from "./guards";
import {
  BOOKING_ID,
  TODAY,
  completeVisit,
  confirmed,
  readyToStart,
  requested,
  run,
  TODAY_MORNING,
} from "./fixtures";
import { addDays } from "./dates";
import { createSeedState } from "./seed";

describe("занятые дни", () => {
  it("дни живой брони заняты", () => {
    const busy = busyDates(requested());
    expect(busy.has(TODAY)).toBe(true);
  });

  it("отклонённая и отменённая бронь дни не занимает", () => {
    const declined = run([{ type: "BookingDeclined", bookingId: BOOKING_ID }], requested());
    expect(busyDates(declined).has(TODAY)).toBe(false);

    const cancelled = run([{ type: "BookingCancelled", bookingId: BOOKING_ID }], confirmed());
    expect(busyDates(cancelled).has(TODAY)).toBe(false);
  });
});

describe("заявка на бронь", () => {
  const free = createSeedState();
  const draft = { startDate: TODAY, endDate: addDays(TODAY, 2), slots: ["morning"] as const };

  it("полностью заполненная заявка на свободные дни разрешена", () => {
    expect(canRequestBooking(free, { ...draft, slots: ["morning"] })).toEqual({ allowed: true });
  });

  it("без первого дня — причина названа", () => {
    const guard = canRequestBooking(free, { ...draft, startDate: null, slots: ["morning"] });
    expect(guard).toEqual({ allowed: false, reason: "Pick the first day of the stay" });
  });

  it("без последнего дня — причина названа", () => {
    const guard = canRequestBooking(free, { ...draft, endDate: null, slots: ["morning"] });
    expect(guard).toEqual({ allowed: false, reason: "Pick the last day of the stay" });
  });

  it("без визитов в дне — причина названа", () => {
    const guard = canRequestBooking(free, { ...draft, slots: [] });
    expect(guard.allowed).toBe(false);
    expect(guard).toHaveProperty("reason", "Pick at least one visit a day");
  });

  it("пересечение с существующей бронью запрещено", () => {
    const guard = canRequestBooking(requested(), { ...draft, slots: ["morning"] });
    expect(guard).toEqual({
      allowed: false,
      reason: "Some days in this range are already booked",
    });
  });
});

describe("готовность к опеке", () => {
  it("до принятия заявки опека не начинается", () => {
    const guard = canStartCare(requested(), BOOKING_ID);
    expect(guard.allowed).toBe(false);
  });

  it("причина называет и знакомство, и ключи", () => {
    const guard = canStartCare(confirmed(), BOOKING_ID);
    expect(guard).toEqual({
      allowed: false,
      reason: "Starts after the meet & greet and the key handoff",
    });
  });

  it("после знакомства остаются только ключи", () => {
    const state = run(
      [
        { type: "MeetGreetProposed", bookingId: BOOKING_ID, by: "family", meetingAt: TODAY },
        { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "sitter" },
        { type: "MeetGreetHappened", bookingId: BOOKING_ID },
      ],
      confirmed(),
    );
    expect(canStartCare(state, BOOKING_ID)).toEqual({
      allowed: false,
      reason: "Starts after the key handoff",
    });
  });

  it("знакомство прошло и ключи переданы — опека началась", () => {
    expect(canStartCare(readyToStart(), BOOKING_ID)).toEqual({ allowed: true });
    expect(canStartCare(completeVisit(readyToStart(), TODAY_MORNING), BOOKING_ID)).toEqual({
      allowed: true,
    });
  });
});
