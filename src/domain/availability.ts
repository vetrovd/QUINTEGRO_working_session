import { eachDate } from "./dates";
import type { DomainState, IsoDate } from "./types";

/**
 * Дни, на которые бронь уже есть. Занятыми считаются дни живых броней —
 * отклонённые и отменённые не мешают: они никого никуда не зовут.
 */
export function busyDates(state: DomainState): Set<IsoDate> {
  const busy = new Set<IsoDate>();
  for (const booking of Object.values(state.bookings)) {
    if (booking.status === "declined" || booking.status === "cancelled") continue;
    for (const date of eachDate(booking.startDate, booking.endDate)) busy.add(date);
  }
  return busy;
}
