import { earnedTotalMinor, plannedTotalMinor } from "../domain/earnings";
import { formatMoney } from "../domain/money";
import type { BookingId, DomainState } from "../domain/types";
import { visitsOfBooking } from "../domain/visits";
import { formatDate, formatTime, plural, slotName } from "./format";

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
  const missed = visits.filter((visit) => visit.status === "missed");
  const last = visited.at(-1);

  return (
    <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
      <p>
        Visits: {visited.length} of {visits.length} happened, {plural(reported.length, "report")}{" "}
        filed
        {missed.length > 0 && `, ${missed.length} missed`}.
        {last?.checkedInAt && (
          <>
            {" "}
            Latest — {formatDate(last.date)}, {slotName(last.slot).toLowerCase()}, sitter on site
            since {formatTime(last.checkedInAt)}.
          </>
        )}
      </p>
      {/* Начислено считается по завершённым визитам, а не по плану периода. */}
      <p className="mt-1 text-stone-600">
        Earned on completed visits: {formatMoney(earnedTotalMinor(state, bookingId))} · planned{" "}
        {formatMoney(plannedTotalMinor(state, bookingId))}
      </p>
    </div>
  );
}
