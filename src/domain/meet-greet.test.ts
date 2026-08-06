import { describe, expect, it } from "vitest";
import {
  BOOKING_ID,
  CTX,
  NOW,
  booking,
  bookingRequested,
  confirmed,
  lastRejection,
  requested,
  run,
} from "./fixtures";
import { canAcceptMeetGreet, canProposeMeetGreet } from "./guards";
import { reduce } from "./reducer";

const propose = (by: "family" | "sitter", meetingAt = NOW) =>
  ({ type: "MeetGreetProposed", bookingId: BOOKING_ID, by, meetingAt }) as const;

describe("знакомство", () => {
  it("семья предлагает время, ситтер принимает", () => {
    const state = run(
      [propose("family"), { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "sitter" }],
      confirmed(),
    );

    expect(booking(state).meetGreet).toMatchObject({
      status: "accepted",
      proposedBy: "family",
      meetingAt: NOW,
    });
  });

  it("встречное предложение перебивает исходное и меняет, чей ход", () => {
    const counter = "2026-08-08T18:00:00.000Z";
    const state = run([propose("family"), propose("sitter", counter)], confirmed());

    expect(booking(state).meetGreet).toMatchObject({
      status: "proposed",
      proposedBy: "sitter",
      meetingAt: counter,
    });
    expect(canAcceptMeetGreet(state, BOOKING_ID, "family").allowed).toBe(true);
    expect(canAcceptMeetGreet(state, BOOKING_ID, "sitter").allowed).toBe(false);
  });

  it("своё же предложение принять нельзя", () => {
    const proposed = reduce(confirmed(), propose("family"), CTX);
    const state = reduce(proposed, { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "family" }, CTX);

    expect(booking(state).meetGreet.status).toBe("proposed");
    expect(lastRejection(state)).toBe("You can't accept your own proposal");
  });

  it("нельзя дважды подряд предложить время со своей стороны", () => {
    const proposed = reduce(confirmed(), propose("family"), CTX);

    expect(canProposeMeetGreet(proposed, BOOKING_ID, "family").allowed).toBe(false);
    expect(canProposeMeetGreet(proposed, BOOKING_ID, "sitter").allowed).toBe(true);
  });

  it("состоявшимся отмечается только согласованное знакомство", () => {
    const proposed = reduce(confirmed(), propose("family"), CTX);
    const tooEarly = reduce(proposed, { type: "MeetGreetHappened", bookingId: BOOKING_ID }, CTX);

    expect(booking(tooEarly).meetGreet.status).toBe("proposed");
    expect(lastRejection(tooEarly)).toBe("Agree on a time first");

    const accepted = reduce(proposed, { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "sitter" }, CTX);
    const happened = reduce(accepted, { type: "MeetGreetHappened", bookingId: BOOKING_ID }, CTX);

    expect(booking(happened).meetGreet.status).toBe("happened");
  });

  it("нельзя согласовывать знакомство по броне, которую ситтер ещё не принял", () => {
    const state = reduce(requested(), propose("family"), CTX);

    expect(booking(state).meetGreet.status).toBe("none");
    expect(lastRejection(state)).toBe("The sitter hasn't accepted yet");
  });
});

describe("повторная бронь", () => {
  it("пропускает знакомство, если пара уже знакома", () => {
    const met = run(
      [
        propose("family"),
        { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "sitter" },
        { type: "MeetGreetHappened", bookingId: BOOKING_ID },
      ],
      confirmed(),
    );

    const state = reduce(met, { ...bookingRequested, bookingId: "booking-2" }, CTX);

    expect(state.bookings["booking-2"].meetGreet.status).toBe("skipped");
    expect(canProposeMeetGreet(state, "booking-2", "family").allowed).toBe(false);
  });

  it("не пропускает знакомство, если предыдущее так и не состоялось", () => {
    const state = reduce(confirmed(), { ...bookingRequested, bookingId: "booking-2" }, CTX);

    expect(state.bookings["booking-2"].meetGreet.status).toBe("none");
  });
});
