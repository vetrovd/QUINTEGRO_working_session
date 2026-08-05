import type { BookingId, DomainState } from "../domain/types";
import { visitsOfBooking } from "../domain/visits";
import { formatDate, formatTime, slotName } from "./format";

/** Семья в отъезде видит, что ситтер приходил — без ожидания сообщения. */
export function VisitProgress({
  state,
  bookingId,
}: {
  state: DomainState;
  bookingId: BookingId;
}) {
  const visits = visitsOfBooking(state, bookingId).filter((visit) => visit.status !== "cancelled");
  if (visits.length === 0) return null;

  const visited = visits.filter(
    (visit) => visit.status === "checkedIn" || visit.status === "completed",
  );
  const reported = visits.filter((visit) => visit.status === "completed");
  const last = visited.at(-1);

  return (
    <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
      Визиты: {visited.length} из {visits.length} состоялись, отчётов сдано {reported.length}.
      {last?.checkedInAt && (
        <>
          {" "}
          Последний — {formatDate(last.date)}, {slotName(last.slot).toLowerCase()}, ситтер на месте с{" "}
          {formatTime(last.checkedInAt)}.
        </>
      )}
    </p>
  );
}
