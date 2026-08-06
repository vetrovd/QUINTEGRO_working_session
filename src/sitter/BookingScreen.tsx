import { useState } from "react";
import { canRespondToBooking } from "../domain/guards";
import type { BookingId } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { BookingSummary } from "../app/BookingSummary";
import { routeToHash } from "../app/routes";
import { EmptyState, GuardedButton, ScreenTitle, inputClass } from "../app/ui";
import { BookingTimeline } from "../booking/BookingTimeline";

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

      {booking.status === "requested" && (
        <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
          <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
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
