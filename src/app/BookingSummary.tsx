import { countDays } from "../domain/dates";
import { bookingTotalMinor } from "../domain/earnings";
import { formatMoney } from "../domain/money";
import type { Booking, DomainState, Role } from "../domain/types";
import { formatDateRange, plural, slotsLabel } from "./format";
import { StatusChip } from "./ui";

/**
 * Шапка экрана брони: условия, о которых договорились. Одинакова для обеих
 * ролей — расходится только то, кого показывать второй стороной.
 */
export function BookingSummary({
  booking,
  state,
  counterpart,
}: {
  booking: Booking;
  state: DomainState;
  counterpart: Role;
}) {
  const pet = state.pets[booking.petId];
  const family = state.families[booking.familyId];
  const sitter = state.sitters[booking.sitterId];
  const days = countDays(booking.startDate, booking.endDate);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-title text-stone-900">
            {formatDateRange(booking.startDate, booking.endDate)}
          </p>
          <p className="mt-1 text-meta text-stone-500">
            {plural(days, "day")} · {plural(booking.slots.length, "visit")} a day ·{" "}
            {slotsLabel(booking.slots)}
          </p>
        </div>
        <StatusChip status={booking.status} />
      </div>

      <dl className="mt-4 flex flex-col gap-1.5 border-t border-stone-100 pt-4 text-meta">
        <Row label="Pet" value={`${pet.name} — ${pet.species}`} />
        {counterpart === "sitter" ? (
          <Row label="Sitter" value={sitter.name} />
        ) : (
          <Row label="Family" value={`${family.name}, ${family.address}`} />
        )}
        <Row
          label="Total"
          value={`${formatMoney(bookingTotalMinor(state, booking.id))} · ${formatMoney(booking.ratePerVisitMinor)} a visit`}
        />
      </dl>

      {booking.declineReason && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-meta text-red-900">
          Reason for declining: {booking.declineReason}
        </p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-stone-500">{label}:</dt>
      <dd className="text-stone-900">{value}</dd>
    </div>
  );
}
