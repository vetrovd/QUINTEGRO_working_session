import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  BOOKING_ID,
  CTX,
  NOW,
  TODAY,
  booking,
  confirmed,
  lastRejection,
  readyToStart,
} from "./fixtures";
import { canCheckIn } from "./guards";
import { reduce } from "./reducer";
import { visitId, visitsOfBooking } from "./visits";

const todayMorning = visitId(BOOKING_ID, TODAY, "morning");
const tomorrowMorning = visitId(BOOKING_ID, addDays(TODAY, 1), "morning");
const checkIn = (id: string) =>
  ({ type: "VisitCheckedIn", visitId: id }) as const;

describe("отметка прихода", () => {
  it("недоступна, пока передача ключей не подтверждена обеими сторонами", () => {
    const withoutKeys = confirmed();

    expect(canCheckIn(withoutKeys, todayMorning, NOW)).toMatchObject({
      allowed: false,
      reason:
        "The key handoff isn't confirmed by both sides — you have no way in",
    });

    const state = reduce(withoutKeys, checkIn(todayMorning), CTX);

    expect(state.visits[todayMorning].status).toBe("scheduled");
    expect(lastRejection(state)).toBeDefined();
  });

  it("недоступна для визита, который ещё не наступил", () => {
    expect(canCheckIn(readyToStart(), tomorrowMorning, NOW)).toMatchObject({
      allowed: false,
      reason: "This visit hasn't come around yet",
    });
  });

  it("переводит визит в «пришёл» и фиксирует время", () => {
    const state = reduce(readyToStart(), checkIn(todayMorning), CTX);

    expect(state.visits[todayMorning]).toMatchObject({
      status: "checkedIn",
      checkedInAt: NOW,
    });
  });

  it("первый приход переводит бронь в работу", () => {
    const state = reduce(readyToStart(), checkIn(todayMorning), CTX);

    expect(booking(state).status).toBe("inProgress");
    expect(booking(state).startedAt).toBe(NOW);
  });

  it("второй приход не сдвигает время начала опеки", () => {
    const first = reduce(readyToStart(), checkIn(todayMorning), CTX);
    const second = reduce(
      first,
      checkIn(visitId(BOOKING_ID, TODAY, "evening")),
      {
        now: "2026-08-05T19:30:00.000Z",
      },
    );

    expect(booking(second).startedAt).toBe(NOW);
    expect(booking(second).status).toBe("inProgress");
  });

  it("повторная отметка того же визита отклоняется", () => {
    const first = reduce(readyToStart(), checkIn(todayMorning), CTX);
    const second = reduce(first, checkIn(todayMorning), CTX);

    expect(lastRejection(second)).toBe("You're already checked in");
  });

  it("визит отменённой брони отметить нельзя", () => {
    const cancelled = reduce(
      confirmed(),
      { type: "BookingCancelled", bookingId: BOOKING_ID },
      CTX,
    );

    expect(canCheckIn(cancelled, todayMorning, NOW)).toMatchObject({
      allowed: false,
      reason: "This visit is canceled",
    });
  });

  it("начавшуюся опеку нельзя отменить как бронь", () => {
    const started = reduce(readyToStart(), checkIn(todayMorning), CTX);
    const state = reduce(
      started,
      { type: "BookingCancelled", bookingId: BOOKING_ID },
      CTX,
    );

    expect(booking(state).status).toBe("inProgress");
    expect(lastRejection(state)).toBe(
      "Care has already started — end it early instead",
    );
    expect(
      visitsOfBooking(state, BOOKING_ID).some(
        (visit) => visit.status === "cancelled",
      ),
    ).toBe(false);
  });
});
