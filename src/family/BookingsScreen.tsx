import { SEED_FAMILY_ID } from "../domain/seed";
import { useStore } from "../store/StoreProvider";
import { BookingCard } from "../app/BookingCard";
import { routeToHash } from "../app/routes";
import { EmptyState, ScreenTitle } from "../app/ui";
import { ReportsFeed } from "./ReportsFeed";

export function FamilyBookingsScreen() {
  const { state } = useStore();
  const bookings = Object.values(state.bookings)
    .filter((booking) => booking.familyId === SEED_FAMILY_ID)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  return (
    <>
      <ScreenTitle hint="Status updates the moment the sitter responds">Bookings</ScreenTitle>

      <a
        href={routeToHash({ role: "family", screen: "newBooking" })}
        className="mb-5 block rounded-md bg-stone-900 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-stone-700"
      >
        Book a sitter
      </a>

      {bookings.length === 0 ? (
        <EmptyState>No bookings yet. Start by booking a sitter.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {bookings.map((booking) => (
            <a
              key={booking.id}
              href={routeToHash({ role: "family", screen: "booking", bookingId: booking.id })}
              className="block"
            >
              <BookingCard booking={booking} state={state} />
            </a>
          ))}
        </div>
      )}

      <div className="mt-8">
        <ReportsFeed />
      </div>
    </>
  );
}
