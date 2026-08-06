import { useState } from "react";
import { bookingTotalMinor, earningsByBooking, lockReasonOf } from "../domain/earnings";
import { canRespondToBooking } from "../domain/guards";
import { formatMoney, netMinor } from "../domain/money";
import type { Booking, BookingId, DomainState } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { BookingSummary } from "../app/BookingSummary";
import { plural } from "../app/format";
import { routeToHash } from "../app/routes";
import { EmptyState, GuardedButton, ScreenTitle, inputClass } from "../app/ui";
import { BookingTimeline } from "../booking/BookingTimeline";
import { PartChips } from "./EarningsBreakdown";

export function SitterBookingScreen({ bookingId }: { bookingId: BookingId }) {
  const { state } = useStore();
  const booking = state.bookings[bookingId];
  const back = { href: routeToHash({ role: "sitter", screen: "bookings" }), label: "Bookings" };

  if (!booking) {
    return (
      <>
        <ScreenTitle back={back}>Booking</ScreenTitle>
        <EmptyState>This booking no longer exists.</EmptyState>
      </>
    );
  }

  return (
    <>
      <ScreenTitle back={back}>Booking</ScreenTitle>
      <BookingSummary booking={booking} state={state} counterpart="family" />

      <div className="mt-3">
        <PayHeader booking={booking} state={state} />
      </div>

      {booking.status === "requested" && (
        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
          <p className="rounded-lg bg-stone-50 px-3 py-2.5 text-meta text-stone-700">
            <span className="font-medium">Care: </span>
            {state.pets[booking.petId].careNotes}
          </p>
          <RespondActions bookingId={booking.id} />
        </div>
      )}

      <div className="mt-6">
        <BookingTimeline booking={booking} role="sitter" />
      </div>
    </>
  );
}

/**
 * Что бронь принесёт и в каком состоянии эти деньги — здесь же, в шапке.
 * Работа и деньги за неё принадлежат разным разделам, поэтому связь между
 * ними должна быть переходом, а не памятью ситтера.
 */
function PayHeader({ booking, state }: { booking: Booking; state: DomainState }) {
  const row = earningsByBooking(state, booking.sitterId).find(
    (item) => item.bookingId === booking.id,
  );
  const plannedNet = netMinor(bookingTotalMinor(state, booking.id));
  const lockReason = row && row.parts.locked.count > 0 ? lockReasonOf(state, booking.id) : undefined;

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-body text-stone-600">{row ? "Earned so far" : "This booking pays"}</p>
        <p className="text-figure tabular-nums text-stone-900">
          {formatMoney(row ? row.total.netMinor : plannedNet)}
        </p>
      </div>
      <p className="mt-1 text-meta text-stone-500">
        {row
          ? `take-home from ${plural(row.total.count, "filed visit")} · ${formatMoney(plannedNet)} if every visit happens`
          : "take-home if every visit happens · an earning appears with every filed report"}
      </p>

      {row && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <PartChips parts={row.parts} />
        </div>
      )}

      {lockReason && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-meta text-amber-900">{lockReason}</p>
      )}

      {/* Ссылка ведёт на строку брони в разбивке, а строка появляется вместе с
          первым начислением: до него вести некуда, и ссылки нет. */}
      {row && (
        <a
          href={routeToHash({ role: "sitter", screen: "earnings", bookingId: booking.id })}
          className="mt-3 inline-flex text-meta text-stone-500 underline underline-offset-2 transition hover:text-stone-900"
        >
          See it in Earnings <span aria-hidden="true" className="ml-0.5">→</span>
        </a>
      )}
    </section>
  );
}

function RespondActions({ bookingId }: { bookingId: BookingId }) {
  const { state, dispatch } = useStore();
  const [reason, setReason] = useState("");
  const guard = canRespondToBooking(state, bookingId);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-stone-200 pt-4">
      <GuardedButton guard={guard} onClick={() => dispatch({ type: "BookingAccepted", bookingId })}>
        Accept
      </GuardedButton>
      <input
        type="text"
        value={reason}
        placeholder="Reason for declining (optional)"
        onChange={(event) => setReason(event.target.value)}
        className={inputClass}
      />
      <GuardedButton
        tone="danger"
        guard={guard}
        onClick={() =>
          dispatch({ type: "BookingDeclined", bookingId, reason: reason.trim() || undefined })
        }
      >
        Decline
      </GuardedButton>
    </div>
  );
}
