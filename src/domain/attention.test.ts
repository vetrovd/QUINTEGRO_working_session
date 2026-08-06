import { describe, expect, it } from "vitest";
import {
  BOOKING_ID,
  CTX,
  NOW,
  TODAY_MORNING,
  checkedIn,
  closed,
  confirmed,
  handbackRequested,
  readyToStart,
  requested,
  run,
} from "./fixtures";
import { awaitsFamilyAction, openVisitsCount, pendingRequestsCount } from "./attention";
import { reduce } from "./reducer";
import { SEED_SITTER_ID, createSeedState } from "./seed";

/**
 * Отметки внимания отвечают на вопрос «куда мне сейчас». Считает их домен:
 * интерфейс не должен решать, чей сейчас ход, — он и так уже решён моделью.
 */
describe("ждут действия семьи", () => {
  it("не ждут, пока ситтер не ответил на запрос", () => {
    expect(awaitsFamilyAction(requested(), BOOKING_ID)).toBe(false);
  });

  it("ждут, когда ситтер предложил время знакомства", () => {
    const state = reduce(
      confirmed(),
      { type: "MeetGreetProposed", bookingId: BOOKING_ID, by: "sitter", meetingAt: NOW },
      CTX,
    );

    expect(awaitsFamilyAction(state, BOOKING_ID)).toBe(true);
  });

  it("не ждут, когда время знакомства предложила сама семья", () => {
    const state = reduce(
      confirmed(),
      { type: "MeetGreetProposed", bookingId: BOOKING_ID, by: "family", meetingAt: NOW },
      CTX,
    );

    expect(awaitsFamilyAction(state, BOOKING_ID)).toBe(false);
  });

  it("ждут, когда передачу ключей предложил ситтер, а семья не подтвердила", () => {
    const state = run(
      [
        { type: "MeetGreetProposed", bookingId: BOOKING_ID, by: "family", meetingAt: NOW },
        { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "sitter" },
        { type: "MeetGreetHappened", bookingId: BOOKING_ID },
        {
          type: "KeyHandoverProposed",
          bookingId: BOOKING_ID,
          direction: "handover",
          by: "sitter",
          method: "lockbox",
          meetingAt: NOW,
        },
      ],
      confirmed(),
    );

    expect(awaitsFamilyAction(state, BOOKING_ID)).toBe(true);
  });

  it("перестают ждать, когда семья подтвердила передачу", () => {
    expect(awaitsFamilyAction(readyToStart(), BOOKING_ID)).toBe(false);
  });

  /** Главный случай: на подтверждении закрытия висят деньги ситтера (ADR 0001). */
  it("ждут, когда ситтер заявил сдачу работы", () => {
    expect(awaitsFamilyAction(handbackRequested(), BOOKING_ID)).toBe(true);
  });

  it("не ждут у закрытой брони", () => {
    expect(awaitsFamilyAction(closed(), BOOKING_ID)).toBe(false);
  });
});

describe("отметки ситтера", () => {
  it("считает запросы, ждущие ответа", () => {
    expect(pendingRequestsCount(requested(), SEED_SITTER_ID)).toBe(1);
    expect(pendingRequestsCount(confirmed(), SEED_SITTER_ID)).toBe(0);
    expect(pendingRequestsCount(createSeedState(), SEED_SITTER_ID)).toBe(0);
  });

  it("считает визит с отмеченным приходом незакрытым, пока нет отчёта", () => {
    expect(openVisitsCount(checkedIn(), SEED_SITTER_ID, NOW)).toBe(1);
  });

  it("считает просроченным визит, день которого прошёл без отметки", () => {
    const tomorrow = "2026-08-06T09:00:00.000Z";

    expect(openVisitsCount(readyToStart(), SEED_SITTER_ID, tomorrow)).toBeGreaterThan(0);
  });

  it("не считает запланированные визиты будущих дней", () => {
    expect(openVisitsCount(readyToStart(), SEED_SITTER_ID, NOW)).toBe(0);
  });

  it("не считает визит, по которому отчёт сдан", () => {
    const state = run(
      [
        { type: "VisitReportSaved", visitId: TODAY_MORNING, tasks: ["feeding"], note: "", photos: [] },
        { type: "VisitReportSubmitted", visitId: TODAY_MORNING },
      ],
      checkedIn(),
    );

    expect(openVisitsCount(state, SEED_SITTER_ID, NOW)).toBe(0);
  });

  /** У закрытой брони незакрытых визитов нет, даже если их день давно прошёл. */
  it("не считает визиты закрытой брони", () => {
    expect(openVisitsCount(closed(), SEED_SITTER_ID, "2026-08-20T09:00:00.000Z")).toBe(0);
  });
});
