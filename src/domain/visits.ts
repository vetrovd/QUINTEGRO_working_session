import { eachDate } from "./dates";
import { SLOTS_OF_DAY } from "./types";
import type { Booking, DomainState, Visit, VisitId } from "./types";

/**
 * Booking — период; Visit — единица работы и начисления. Разворачивание
 * детерминированное: идентификатор визита выводится из брони, даты и слота,
 * поэтому редьюсер остаётся чистым.
 */
export function expandVisits(booking: Booking): Visit[] {
  const slots = SLOTS_OF_DAY.filter((slot) => booking.slots.includes(slot));
  return eachDate(booking.startDate, booking.endDate).flatMap((date) =>
    slots.map((slot) => ({
      id: visitId(booking.id, date, slot),
      bookingId: booking.id,
      date,
      slot,
      status: "scheduled" as const,
    })),
  );
}

export function visitId(bookingId: string, date: string, slot: string): VisitId {
  return `${bookingId}:${date}:${slot}`;
}

export function visitsOfBooking(state: DomainState, bookingId: string): Visit[] {
  return Object.values(state.visits)
    .filter((visit) => visit.bookingId === bookingId)
    .sort(compareVisits);
}

export function compareVisits(a: Visit, b: Visit): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return SLOTS_OF_DAY.indexOf(a.slot) - SLOTS_OF_DAY.indexOf(b.slot);
}
