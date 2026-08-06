import { addDays, today } from "./dates";
import { reduce, reduceAll } from "./reducer";
import type { ReduceContext } from "./reducer";
import { SEED_FAMILY_ID, SEED_PET_ID, SEED_SITTER_ID, createSeedState } from "./seed";
import type { DomainEvent, DomainState } from "./types";
import { visitId } from "./visits";

/**
 * Общие заготовки для тестов домена. Даты считаются от «сегодня», чтобы
 * проверки, зависящие от календаря, не ломались от часового пояса машины.
 */
export const NOW = "2026-08-05T09:00:00.000Z";
export const CTX: ReduceContext = { now: NOW };
export const TODAY = today(NOW);
export const BOOKING_ID = "booking-1";

/** Конкретный член объединения, а не DomainEvent — иначе спред теряет тип. */
export const bookingRequested: Extract<DomainEvent, { type: "BookingRequested" }> = {
  type: "BookingRequested",
  bookingId: BOOKING_ID,
  familyId: SEED_FAMILY_ID,
  sitterId: SEED_SITTER_ID,
  petId: SEED_PET_ID,
  startDate: TODAY,
  endDate: addDays(TODAY, 4),
  slots: ["morning", "evening"],
};

export function run(events: DomainEvent[], state = createSeedState()): DomainState {
  return reduceAll(state, events, CTX);
}

export function requested(): DomainState {
  return reduce(createSeedState(), bookingRequested, CTX);
}

export function confirmed(): DomainState {
  return run([bookingRequested, { type: "BookingAccepted", bookingId: BOOKING_ID }]);
}

/** Знакомство состоялось, ключи переданы — бронь готова к старту. */
export function readyToStart(): DomainState {
  return run(
    [
      { type: "MeetGreetProposed", bookingId: BOOKING_ID, by: "family", meetingAt: NOW },
      { type: "MeetGreetAccepted", bookingId: BOOKING_ID, by: "sitter" },
      { type: "MeetGreetHappened", bookingId: BOOKING_ID },
      {
        type: "KeyHandoverProposed",
        bookingId: BOOKING_ID,
        direction: "handover",
        by: "family",
        method: "inPerson",
        meetingAt: NOW,
      },
      { type: "KeyHandoverConfirmed", bookingId: BOOKING_ID, direction: "handover", by: "sitter" },
    ],
    confirmed(),
  );
}

export const TODAY_MORNING = visitId(BOOKING_ID, TODAY, "morning");

/** Ситтер отметил приход на сегодняшний утренний визит. */
export function checkedIn(): DomainState {
  return reduce(readyToStart(), { type: "VisitCheckedIn", visitId: TODAY_MORNING }, CTX);
}

/** Приход отмечен, отчёт заполнен и отправлен — визит завершён и начислен. */
export function completeVisit(state: DomainState, id: string): DomainState {
  return run(
    [
      { type: "VisitCheckedIn", visitId: id },
      { type: "VisitReportSaved", visitId: id, tasks: ["feeding"], note: "", photos: [] },
      { type: "VisitReportSubmitted", visitId: id },
    ],
    state,
  );
}

/** Ключи возвращены обеими сторонами — можно заявлять сдачу работы. */
export function keysReturned(state: DomainState): DomainState {
  return run(
    [
      {
        type: "KeyHandoverProposed",
        bookingId: BOOKING_ID,
        direction: "return",
        by: "sitter",
        method: "inPerson",
        meetingAt: NOW,
      },
      { type: "KeyHandoverConfirmed", bookingId: BOOKING_ID, direction: "return", by: "family" },
    ],
    state,
  );
}

/** Один визит завершён, ключи возвращены — всё готово к сдаче работы. */
export function workDone(): DomainState {
  return keysReturned(completeVisit(readyToStart(), TODAY_MORNING));
}

export function handbackRequested(): DomainState {
  return reduce(workDone(), { type: "HandbackRequested", bookingId: BOOKING_ID }, CTX);
}

/** Семья подтвердила закрытие: бронь закрыта, деньги разблокированы. */
export function closed(): DomainState {
  return reduce(handbackRequested(), { type: "HandbackConfirmed", bookingId: BOOKING_ID }, CTX);
}

/** Семья оспорила сдачу работы — терминальный тупик прототипа. */
export function disputed(reason = "Лоток не убран, воды нет"): DomainState {
  return reduce(
    handbackRequested(),
    { type: "HandbackDisputed", bookingId: BOOKING_ID, reason },
    CTX,
  );
}

export const TODAY_EVENING = visitId(BOOKING_ID, TODAY, "evening");

/** Закрытая бронь с двумя начислениями — на них проверяется частичный вывод. */
export function closedTwoVisits(): DomainState {
  const worked = completeVisit(completeVisit(readyToStart(), TODAY_MORNING), TODAY_EVENING);
  return run(
    [
      { type: "HandbackRequested", bookingId: BOOKING_ID },
      { type: "HandbackConfirmed", bookingId: BOOKING_ID },
    ],
    keysReturned(worked),
  );
}

export function booking(state: DomainState) {
  return state.bookings[BOOKING_ID];
}

export function lastRejection(state: DomainState): string | undefined {
  return state.journal.at(-1)?.rejection;
}
