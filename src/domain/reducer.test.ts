import { describe, expect, it } from "vitest";
import {
  BOOKING_ID,
  CTX,
  NOW,
  TODAY,
  booking,
  bookingRequested,
  confirmed,
  lastRejection,
  requested,
  run,
} from "./fixtures";
import { canCancelBooking, canRespondToBooking } from "./guards";
import { reduce } from "./reducer";
import { createSeedState } from "./seed";
import { SEED_FAMILY_ID, SEED_PET_ID, SEED_SITTER_ID } from "./seed";

describe("запрос брони", () => {
  it("создаёт бронь в статусе ожидания ответа со всеми параметрами", () => {
    expect(booking(requested())).toMatchObject({
      status: "requested",
      familyId: SEED_FAMILY_ID,
      sitterId: SEED_SITTER_ID,
      petId: SEED_PET_ID,
      startDate: TODAY,
      slots: ["morning", "evening"],
      ratePerVisitMinor: 2_000,
    });
  });

  it("берёт время из переданных часов, а не из системных", () => {
    const state = reduce(createSeedState(), bookingRequested, { now: "2026-01-01T00:00:00.000Z" });

    expect(booking(state).requestedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("не создаёт вторую бронь с тем же идентификатором", () => {
    const state = run([bookingRequested, bookingRequested]);

    expect(Object.keys(state.bookings)).toHaveLength(1);
    expect(lastRejection(state)).toBeDefined();
  });
});

describe("ответ ситтера", () => {
  it("принятие переводит бронь в принятую и фиксирует время ответа", () => {
    const state = confirmed();

    expect(booking(state).status).toBe("confirmed");
    expect(booking(state).respondedAt).toBe(NOW);
  });

  it("отклонение переводит бронь в отклонённую и сохраняет причину", () => {
    const state = reduce(
      requested(),
      { type: "BookingDeclined", bookingId: BOOKING_ID, reason: "Занята на эти даты" },
      CTX,
    );

    expect(booking(state).status).toBe("declined");
    expect(booking(state).declineReason).toBe("Занята на эти даты");
  });

  it("повторный ответ на уже принятую бронь отклоняется", () => {
    const accepted = confirmed();

    expect(canRespondToBooking(accepted, BOOKING_ID).allowed).toBe(false);

    const state = reduce(accepted, { type: "BookingDeclined", bookingId: BOOKING_ID }, CTX);

    expect(booking(state).status).toBe("confirmed");
    expect(lastRejection(state)).toBeDefined();
  });
});

describe("отмена семьёй", () => {
  it("отменяет бронь, ожидающую ответа", () => {
    const state = reduce(requested(), { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);

    expect(booking(state).status).toBe("cancelled");
    expect(booking(state).cancelledAt).toBe(NOW);
  });

  it("отменяет уже принятую бронь — она ещё не началась", () => {
    const state = reduce(confirmed(), { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);

    expect(booking(state).status).toBe("cancelled");
  });

  it("не отменяет бронь, отклонённую ситтером", () => {
    const declined = reduce(requested(), { type: "BookingDeclined", bookingId: BOOKING_ID }, CTX);

    expect(canCancelBooking(declined, BOOKING_ID).allowed).toBe(false);

    const state = reduce(declined, { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);

    expect(booking(state).status).toBe("declined");
    expect(lastRejection(state)).toBe("The sitter declined — nothing to cancel");
  });

  it("не отменяет бронь дважды", () => {
    const cancelled = reduce(requested(), { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);
    const state = reduce(cancelled, { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);

    expect(lastRejection(state)).toBe("This booking is already canceled");
  });
});

describe("журнал", () => {
  it("записывает каждое событие, включая отклонённые переходы", () => {
    const state = run([
      bookingRequested,
      { type: "BookingDeclined", bookingId: BOOKING_ID },
      { type: "BookingCancelled", bookingId: BOOKING_ID },
    ]);

    expect(state.journal.map((entry) => [entry.event.type, Boolean(entry.rejection)])).toEqual([
      ["BookingRequested", false],
      ["BookingDeclined", false],
      ["BookingCancelled", true],
    ]);
  });

  it("отклонённый переход не меняет состояние, кроме журнала", () => {
    const before = reduce(requested(), { type: "BookingDeclined", bookingId: BOOKING_ID }, CTX);
    const after = reduce(before, { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);

    expect(after.bookings).toEqual(before.bookings);
    expect(after.visits).toEqual(before.visits);
  });
});
