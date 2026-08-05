import { describe, expect, it } from "vitest";
import { fixedClock } from "./clock";
import { canCancelBooking, canRespondToBooking } from "./guards";
import { reduce, reduceAll } from "./reducer";
import { SEED_FAMILY_ID, SEED_PET_ID, SEED_SITTER_ID, createSeedState } from "./seed";
import type { DomainEvent, DomainState } from "./types";

const clock = fixedClock("2026-08-05T09:00:00.000Z");
const ctx = { now: clock.now() };

const requested: DomainEvent = {
  type: "BookingRequested",
  bookingId: "booking-1",
  familyId: SEED_FAMILY_ID,
  sitterId: SEED_SITTER_ID,
  petId: SEED_PET_ID,
  startDate: "2026-08-10",
  endDate: "2026-08-14",
  slots: ["morning", "evening"],
  ratePerVisitMinor: 70_000,
};

function withRequestedBooking(): DomainState {
  return reduce(createSeedState(), requested, ctx);
}

function booking(state: DomainState) {
  return state.bookings["booking-1"];
}

describe("запрос брони", () => {
  it("создаёт бронь в статусе ожидания ответа со всеми параметрами", () => {
    const state = withRequestedBooking();

    expect(booking(state)).toMatchObject({
      status: "requested",
      familyId: SEED_FAMILY_ID,
      sitterId: SEED_SITTER_ID,
      petId: SEED_PET_ID,
      startDate: "2026-08-10",
      endDate: "2026-08-14",
      slots: ["morning", "evening"],
      ratePerVisitMinor: 70_000,
    });
  });

  it("берёт время из переданных часов, а не из системных", () => {
    const state = reduce(createSeedState(), requested, { now: "2026-01-01T00:00:00.000Z" });

    expect(booking(state).requestedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("не создаёт вторую бронь с тем же идентификатором", () => {
    const state = reduceAll(createSeedState(), [requested, requested], ctx);

    expect(Object.keys(state.bookings)).toHaveLength(1);
    expect(state.journal.at(-1)?.rejection).toBeDefined();
  });
});

describe("ответ ситтера", () => {
  it("принятие переводит бронь в принятую и фиксирует время ответа", () => {
    const state = reduce(withRequestedBooking(), { type: "BookingAccepted", bookingId: "booking-1" }, ctx);

    expect(booking(state).status).toBe("confirmed");
    expect(booking(state).respondedAt).toBe(ctx.now);
  });

  it("отклонение переводит бронь в отклонённую и сохраняет причину", () => {
    const state = reduce(
      withRequestedBooking(),
      { type: "BookingDeclined", bookingId: "booking-1", reason: "Занята на эти даты" },
      ctx,
    );

    expect(booking(state).status).toBe("declined");
    expect(booking(state).declineReason).toBe("Занята на эти даты");
  });

  it("повторный ответ на уже принятую бронь отклоняется", () => {
    const accepted = reduce(withRequestedBooking(), { type: "BookingAccepted", bookingId: "booking-1" }, ctx);

    expect(canRespondToBooking(accepted, "booking-1").allowed).toBe(false);

    const state = reduce(accepted, { type: "BookingDeclined", bookingId: "booking-1" }, ctx);

    expect(booking(state).status).toBe("confirmed");
    expect(state.journal.at(-1)?.rejection).toBeDefined();
  });
});

describe("отмена семьёй", () => {
  it("отменяет бронь, ожидающую ответа", () => {
    const state = reduce(withRequestedBooking(), { type: "BookingCancelled", bookingId: "booking-1" }, ctx);

    expect(booking(state).status).toBe("cancelled");
    expect(booking(state).cancelledAt).toBe(ctx.now);
  });

  it("отменяет уже принятую бронь — она ещё не началась", () => {
    const accepted = reduce(withRequestedBooking(), { type: "BookingAccepted", bookingId: "booking-1" }, ctx);
    const state = reduce(accepted, { type: "BookingCancelled", bookingId: "booking-1" }, ctx);

    expect(booking(state).status).toBe("cancelled");
  });

  it("не отменяет бронь, отклонённую ситтером", () => {
    const declined = reduce(withRequestedBooking(), { type: "BookingDeclined", bookingId: "booking-1" }, ctx);

    expect(canCancelBooking(declined, "booking-1").allowed).toBe(false);

    const state = reduce(declined, { type: "BookingCancelled", bookingId: "booking-1" }, ctx);

    expect(booking(state).status).toBe("declined");
    expect(state.journal.at(-1)?.rejection).toBe("Ситтер отклонил бронь — отменять нечего");
  });

  it("не отменяет бронь дважды", () => {
    const cancelled = reduce(withRequestedBooking(), { type: "BookingCancelled", bookingId: "booking-1" }, ctx);
    const state = reduce(cancelled, { type: "BookingCancelled", bookingId: "booking-1" }, ctx);

    expect(state.journal.at(-1)?.rejection).toBe("Бронь уже отменена");
  });
});

describe("журнал", () => {
  it("записывает каждое событие, включая отклонённые переходы", () => {
    const state = reduceAll(
      createSeedState(),
      [
        requested,
        { type: "BookingDeclined", bookingId: "booking-1" },
        { type: "BookingCancelled", bookingId: "booking-1" },
      ],
      ctx,
    );

    expect(state.journal.map((entry) => [entry.event.type, Boolean(entry.rejection)])).toEqual([
      ["BookingRequested", false],
      ["BookingDeclined", false],
      ["BookingCancelled", true],
    ]);
  });

  it("отклонённый переход не меняет состояние, кроме журнала", () => {
    const before = reduce(withRequestedBooking(), { type: "BookingDeclined", bookingId: "booking-1" }, ctx);
    const after = reduce(before, { type: "BookingCancelled", bookingId: "booking-1" }, ctx);

    expect(after.bookings).toEqual(before.bookings);
  });
});
