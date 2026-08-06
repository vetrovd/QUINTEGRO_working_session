import { routeToHash } from "../app/routes";
import { ScreenTitle } from "../app/ui";
import { BookingCalendar } from "./BookingCalendar";

export function NewBookingScreen() {
  return (
    <>
      <ScreenTitle back={{ href: routeToHash({ role: "family", screen: "bookings" }), label: "Bookings" }}>
        Book a sitter
      </ScreenTitle>
      <BookingCalendar />
    </>
  );
}
