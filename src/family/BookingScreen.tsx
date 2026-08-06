import { canCancelBooking } from "../domain/guards";
import type { BookingId } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { BookingCard } from "../app/BookingCard";
import { VisitProgress } from "../app/VisitProgress";
import { routeToHash } from "../app/routes";
import { EmptyState, GuardedButton, ScreenTitle } from "../app/ui";
import { BookingSteps } from "../booking/BookingSteps";

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
      <BookingCard
        booking={booking}
        state={state}
        actions={
          <GuardedButton
            tone="danger"
            guard={canCancelBooking(state, booking.id)}
            onClick={() => dispatch({ type: "BookingCancelled", bookingId: booking.id })}
          >
            Cancel booking
          </GuardedButton>
        }
      >
        <VisitProgress state={state} bookingId={booking.id} />
        <BookingSteps booking={booking} role="family" />
      </BookingCard>
    </>
  );
}
