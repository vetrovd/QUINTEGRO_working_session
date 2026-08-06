import { describe, expect, it } from "vitest";
import { BOOKING_ID, CTX, NOW, booking, confirmed, lastRejection, readyToStart, run } from "./fixtures";
import {
  awaitingConfirmationFrom,
  canConfirmKeyHandover,
  canProposeKeyHandover,
  missingReadinessSteps,
} from "./guards";
import { reduce } from "./reducer";

const proposeKeys = (by: "family" | "sitter") =>
  ({
    type: "KeyHandoverProposed",
    bookingId: BOOKING_ID,
    direction: "handover",
    by,
    method: "lockbox",
    meetingAt: NOW,
    details: "Лок-бокс на калитке, код скажу при знакомстве",
  }) as const;

const confirmKeys = (by: "family" | "sitter") =>
  ({ type: "KeyHandoverConfirmed", bookingId: BOOKING_ID, direction: "handover", by }) as const;

describe("передача ключей", () => {
  it("предложение фиксирует способ, время и подтверждение предложившего", () => {
    const state = reduce(confirmed(), proposeKeys("family"), CTX);

    expect(booking(state).keys.handover).toMatchObject({
      status: "proposed",
      method: "lockbox",
      proposedBy: "family",
      confirmedByFamily: true,
      confirmedBySitter: false,
    });
  });

  it("подтверждения одной стороны недостаточно — видно, кого ждём", () => {
    const state = reduce(confirmed(), proposeKeys("family"), CTX);

    expect(booking(state).keys.handover.status).not.toBe("done");
    expect(awaitingConfirmationFrom(booking(state), "handover")).toEqual(["sitter"]);
  });

  it("передача состоялась только после подтверждения обеими сторонами", () => {
    const state = run([proposeKeys("family"), confirmKeys("sitter")], confirmed());

    expect(booking(state).keys.handover.status).toBe("done");
    expect(awaitingConfirmationFrom(booking(state), "handover")).toEqual([]);
  });

  it("повторное подтверждение той же стороной не закрывает передачу", () => {
    const proposed = reduce(confirmed(), proposeKeys("family"), CTX);
    const state = reduce(proposed, confirmKeys("family"), CTX);

    expect(booking(state).keys.handover.status).toBe("proposed");
    expect(lastRejection(state)).toBe("You've already confirmed this handoff");
  });

  it("нельзя подтверждать передачу, которую ещё не предложили", () => {
    expect(canConfirmKeyHandover(confirmed(), BOOKING_ID, "handover", "sitter")).toMatchObject({
      allowed: false,
      reason: "Agree on a time and method first",
    });
  });

  it("встречное предложение доступно второй стороне, но не автору", () => {
    const proposed = reduce(confirmed(), proposeKeys("family"), CTX);

    expect(canProposeKeyHandover(proposed, BOOKING_ID, "handover", "family").allowed).toBe(false);
    expect(canProposeKeyHandover(proposed, BOOKING_ID, "handover", "sitter").allowed).toBe(true);
  });

  it("возврат ключей согласуют только когда опека уже идёт", () => {
    expect(canProposeKeyHandover(confirmed(), BOOKING_ID, "return", "sitter")).toMatchObject({
      allowed: false,
      reason: "Keys go back at the end of care",
    });
  });
});

describe("гейт готовности брони", () => {
  it("не срабатывает без знакомства", () => {
    const state = run([proposeKeys("family"), confirmKeys("sitter")], confirmed());

    expect(booking(state).status).toBe("confirmed");
    expect(missingReadinessSteps(booking(state))).toEqual(["the meet & greet"]);
  });

  it("не срабатывает без переданных ключей", () => {
    const state = run(
      [
        { type: "MeetGreetProposed", bookingId: BOOKING_ID, by: "family", meetingAt: NOW },
        { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "sitter" },
        { type: "MeetGreetHappened", bookingId: BOOKING_ID },
      ],
      confirmed(),
    );

    expect(booking(state).status).toBe("confirmed");
    expect(missingReadinessSteps(booking(state))).toEqual(["the key handoff"]);
  });

  it("срабатывает, когда состоялось и знакомство, и передача ключей", () => {
    const state = readyToStart();

    expect(booking(state).status).toBe("readyToStart");
    expect(missingReadinessSteps(booking(state))).toEqual([]);
  });

  it("порядок шагов не важен — ключи раньше знакомства дают тот же результат", () => {
    const state = run(
      [
        proposeKeys("family"),
        confirmKeys("sitter"),
        { type: "MeetGreetProposed", bookingId: BOOKING_ID, by: "sitter", meetingAt: NOW },
        { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "family" },
        { type: "MeetGreetHappened", bookingId: BOOKING_ID },
      ],
      confirmed(),
    );

    expect(booking(state).status).toBe("readyToStart");
  });
});
