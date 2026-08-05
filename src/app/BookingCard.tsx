import type { ReactNode } from "react";
import { formatMoney } from "../domain/money";
import type { Booking, DomainState } from "../domain/types";
import { countDays } from "../domain/dates";
import { Card } from "./ui";
import { formatDateRange, slotsLabel, statusText, statusTone } from "./format";

/** Общее представление брони для обеих ролей — расходятся только действия. */
export function BookingCard({
  booking,
  state,
  actions,
  children,
}: {
  booking: Booking;
  state: DomainState;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const pet = state.pets[booking.petId];
  const family = state.families[booking.familyId];
  const sitter = state.sitters[booking.sitterId];
  const days = countDays(booking.startDate, booking.endDate);
  const visitsPerDay = booking.slots.length;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">
            {formatDateRange(booking.startDate, booking.endDate)}
          </p>
          <p className="text-sm text-stone-500">
            {days} дн. × {visitsPerDay} визит{visitsPerDay === 1 ? "" : "а"} в день ·{" "}
            {slotsLabel(booking.slots)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(booking.status)}`}
        >
          {statusText(booking.status)}
        </span>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Row label="Питомец" value={`${pet.name} — ${pet.species}`} />
        <Row label="Ставка за визит" value={formatMoney(booking.ratePerVisitMinor)} />
        <Row label="Семья" value={`${family.name}, ${family.address}`} />
        <Row label="Ситтер" value={sitter.name} />
      </dl>

      {booking.declineReason && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
          Причина отказа: {booking.declineReason}
        </p>
      )}

      {children}

      {actions && <div className="mt-4 flex flex-wrap items-start gap-3">{actions}</div>}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-stone-500">{label}:</dt>
      <dd className="text-stone-900">{value}</dd>
    </div>
  );
}
