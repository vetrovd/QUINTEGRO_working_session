import { canCancelBooking } from "../domain/guards";
import type { BookingId } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { BookingSummary } from "../app/BookingSummary";
import { routeToHash } from "../app/routes";
import { EmptyState, GuardedButton, ScreenTitle } from "../app/ui";
import { BookingTimeline } from "../booking/BookingTimeline";

export function FamilyBookingScreen({ bookingId }: { bookingId: BookingId }) {
  const { state, dispatch } = useStore();
  const booking = state.bookings[bookingId];
  const back = { href: routeToHash({ role: "family", screen: "bookings" }), label: "Bookings" };

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

      <BookingSummary booking={booking} state={state} counterpart="sitter" />

      <div className="mt-6">
        <BookingTimeline booking={booking} role="family" />
      </div>

      <div className="mt-6 border-t border-stone-200 pt-4">
        <GuardedButton
          tone="danger"
          guard={canCancelBooking(state, booking.id)}
          onClick={() => dispatch({ type: "BookingCancelled", bookingId: booking.id })}
        >
          Cancel booking
        </GuardedButton>
      </div>
    </>
  );
}
