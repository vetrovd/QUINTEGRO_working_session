import { eachDate, today } from "./dates";
import { SLOTS_OF_DAY } from "./types";
import type { Booking, DomainState, IsoDateTime, Visit, VisitId } from "./types";

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

/**
 * Незакрытый визит: приход отмечен, а отчёта нет. Работа началась и не сдана.
 */
export function isAwaitingReport(visit: Visit): boolean {
  return visit.status === "checkedIn";
}

/**
 * Просроченный визит: день прошёл, а визит так и остался запланированным —
 * ни отчёта, ни отметки о пропуске.
 *
 * Оба предиката живут здесь, а не в расписании: по ним считается и отметка на
 * пункте меню, и первые две группы расписания. Разъедься они — меню звало бы
 * туда, где ничего не ждёт.
 */
export function isOverdue(visit: Visit, now: IsoDateTime): boolean {
  return visit.status === "scheduled" && visit.date < today(now);
}

export function compareVisits(a: Visit, b: Visit): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return SLOTS_OF_DAY.indexOf(a.slot) - SLOTS_OF_DAY.indexOf(b.slot);
}
