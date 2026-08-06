import { describe, expect, it } from "vitest";
import {
  checkedIn,
  closed,
  completeVisit,
  confirmed,
  disputed,
  handbackRequested,
  readyToStart,
  requested,
  run,
  workDone,
  BOOKING_ID,
  NOW,
  TODAY_MORNING,
} from "./fixtures";
import { timelineOf } from "./timeline";

describe("таймлайн брони", () => {
  it("до принятия заявки ни один шаг не идёт", () => {
    const steps = timelineOf(requested(), BOOKING_ID);
    expect(steps).toEqual({
      // Сама заявка — шаг пути, и ход по ней за ситтером.
      request: "current",
      meetGreet: "future",
      keyHandover: "future",
      care: "future",
      keyReturn: "future",
      handback: "future",
    });
  });

  it("после принятия текущий шаг — знакомство", () => {
    const steps = timelineOf(confirmed(), BOOKING_ID);
    expect(steps.meetGreet).toBe("current");
    expect(steps.keyHandover).toBe("future");
  });

  it("знакомство пройдено — ключи становятся текущим шагом", () => {
    const state = run(
      [
        { type: "MeetGreetProposed", bookingId: BOOKING_ID, by: "sitter", meetingAt: NOW },
        { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "family" },
        { type: "MeetGreetHappened", bookingId: BOOKING_ID },
      ],
      confirmed(),
    );
    const steps = timelineOf(state, BOOKING_ID);
    expect(steps.meetGreet).toBe("done");
    expect(steps.keyHandover).toBe("current");
  });

  it("ключи переданы — текущим становится опека", () => {
    const steps = timelineOf(readyToStart(), BOOKING_ID);
    expect(steps.meetGreet).toBe("done");
    expect(steps.keyHandover).toBe("done");
    expect(steps.care).toBe("current");
    expect(steps.keyReturn).toBe("future");
  });

  it("незакрытый визит держит опеку текущей", () => {
    expect(timelineOf(checkedIn(), BOOKING_ID).care).toBe("current");
  });

  it("пока есть незакрытые визиты, опека остаётся текущей", () => {
    const steps = timelineOf(completeVisit(readyToStart(), TODAY_MORNING), BOOKING_ID);
    expect(steps.care).toBe("current");
    expect(steps.keyReturn).toBe("future");
  });

  it("ключи вернули — опека закончилась, текущей становится сдача работы", () => {
    // Возврат ключей закрывает опеку, даже если часть визитов осталась в
    // расписании: войти ситтеру больше нечем.
    const steps = timelineOf(workDone(), BOOKING_ID);
    expect(steps.care).toBe("done");
    expect(steps.keyReturn).toBe("done");
    expect(steps.handback).toBe("current");
  });

  it("работа сдана и ждёт подтверждения — шаг всё ещё текущий", () => {
    expect(timelineOf(handbackRequested(), BOOKING_ID).handback).toBe("current");
  });

  it("бронь закрыта — пройдены все шаги", () => {
    const steps = timelineOf(closed(), BOOKING_ID);
    expect(Object.values(steps)).toEqual(["done", "done", "done", "done", "done", "done"]);
  });

  it("спор — это тупик, а не пройденный шаг", () => {
    expect(timelineOf(disputed(), BOOKING_ID).handback).toBe("deadEnd");
  });

  it("отсутствие визитов не считается законченной опекой", () => {
    // Ловушка: «ни одного незакрытого визита» верно и до принятия брони,
    // когда визитов ещё нет вовсе.
    expect(timelineOf(requested(), BOOKING_ID).care).not.toBe("done");
    expect(timelineOf(confirmed(), BOOKING_ID).care).not.toBe("done");
  });

  it("отменённая бронь никуда не идёт", () => {
    const state = run([{ type: "BookingCancelled", bookingId: BOOKING_ID }], confirmed());
    const steps = timelineOf(state, BOOKING_ID);
    expect(Object.values(steps)).not.toContain("current");
  });

  it("у несуществующей брони шагов нет", () => {
    const steps = timelineOf(requested(), "no-such-booking");
    expect(Object.values(steps)).not.toContain("current");
  });

  it("раскрыт ровно один шаг в любом состоянии", () => {
    const states = [
      requested(),
      confirmed(),
      readyToStart(),
      checkedIn(),
      workDone(),
      handbackRequested(),
      closed(),
      disputed(),
    ];
    for (const state of states) {
      const current = Object.values(timelineOf(state, BOOKING_ID)).filter(
        (phase) => phase === "current",
      );
      expect(current.length).toBeLessThanOrEqual(1);
    }
  });
});
