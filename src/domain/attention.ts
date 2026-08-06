import { today } from "./dates";
import type { Booking, BookingId, DomainState, IsoDateTime, SitterId } from "./types";

/**
 * Отметки внимания: «куда мне сейчас». Живут в домене, потому что «чей ход»
 * уже решено моделью — интерфейсу остаётся это показать, а не вывести заново.
 */

/** Бронь стоит на шаге, который двигает семья. */
export function awaitsFamilyAction(state: DomainState, bookingId: BookingId): boolean {
  const booking = state.bookings[bookingId];
  if (!booking) return false;

  // Подтверждение закрытия — самый дорогой ход семьи: на нём висят деньги
  // ситтера, и молчание разрешается только таймаутом (ADR 0001).
  if (booking.status === "awaitingHandback") return true;
  if (!isLive(booking)) return false;

  if (booking.meetGreet.status === "proposed" && booking.meetGreet.proposedBy === "sitter") {
    return true;
  }
  return Object.values(booking.keys).some(
    (handover) => handover.status === "proposed" && !handover.confirmedByFamily,
  );
}

/** Запросы, на которые ситтер ещё не ответил. */
export function pendingRequestsCount(state: DomainState, sitterId: SitterId): number {
  return Object.values(state.bookings).filter(
    (booking) => booking.sitterId === sitterId && booking.status === "requested",
  ).length;
}

/**
 * Визиты, которые ситтер не закрыл: приход отмечен без отчёта, либо день
 * прошёл, а визит так и остался запланированным. Ровно те две группы, которые
 * расписание показывает первыми.
 */
export function openVisitsCount(
  state: DomainState,
  sitterId: SitterId,
  now: IsoDateTime,
): number {
  const currentDate = today(now);

  return Object.values(state.visits).filter((visit) => {
    const booking = state.bookings[visit.bookingId];
    if (booking.sitterId !== sitterId || !isLive(booking)) return false;
    if (visit.status === "checkedIn") return true;
    return visit.status === "scheduled" && visit.date < currentDate;
  }).length;
}

/** Живая бронь — та, по которой ещё возможны действия. */
function isLive(booking: Booking): boolean {
  return (
    booking.status === "confirmed" ||
    booking.status === "readyToStart" ||
    booking.status === "inProgress" ||
    booking.status === "terminatedEarly"
  );
}
