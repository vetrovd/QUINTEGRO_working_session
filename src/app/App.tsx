import { FamilyBookingScreen } from "../family/BookingScreen";
import { FamilyBookingsScreen } from "../family/BookingsScreen";
import { NewBookingScreen } from "../family/NewBookingScreen";
import { SitterBookingScreen } from "../sitter/BookingScreen";
import { SitterBookingsScreen } from "../sitter/BookingsScreen";
import { EarningsScreen } from "../sitter/EarningsScreen";
import { ScheduleScreen } from "../sitter/ScheduleScreen";
import { DebugBar } from "./DebugBar";
import { PhoneFrame } from "./PhoneFrame";
import { RoleSwitcher } from "./RoleSwitcher";
import { SitterNav } from "./SitterNav";
import { useRoute } from "./useRoute";
import type { Route } from "./routes";

export function App() {
  const route = useRoute();

  return (
    <div className="min-h-screen bg-stone-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 p-4 lg:flex-row lg:items-start lg:justify-center lg:py-10">
        <PhoneFrame
          header={
            <>
              <p className="text-sm font-semibold text-stone-900">Pet sitting</p>
              <RoleSwitcher role={route.role} />
            </>
          }
          nav={route.role === "sitter" ? <SitterNav route={route} /> : null}
        >
          <Screen route={route} />
        </PhoneFrame>

        {/* Панель прототипа живёт за пределами рамки: она не часть продукта. */}
        <aside className="w-full max-w-md rounded-lg border border-dashed border-stone-400 bg-stone-50 p-4 lg:sticky lg:top-10 lg:w-80">
          <p className="mb-3 text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Prototype controls
          </p>
          <DebugBar />
        </aside>
      </div>
    </div>
  );
}

function Screen({ route }: { route: Route }) {
  if (route.role === "family") {
    switch (route.screen) {
      case "bookings":
        return <FamilyBookingsScreen />;
      case "newBooking":
        return <NewBookingScreen />;
      case "booking":
        return <FamilyBookingScreen bookingId={route.bookingId} />;
    }
  }

  switch (route.screen) {
    case "bookings":
      return <SitterBookingsScreen />;
    case "booking":
      return <SitterBookingScreen bookingId={route.bookingId} />;
    case "schedule":
      return <ScheduleScreen />;
    case "earnings":
      return <EarningsScreen />;
  }
}
