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
import { routeToHash } from "./routes";
import type { Route } from "./routes";

export function App() {
  const route = useRoute();

  return (
    <div className="workbench min-h-screen">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 p-4 lg:flex-row lg:items-start lg:justify-center lg:py-10">
        <PhoneFrame
          header={
            <>
              <p className="text-body font-semibold text-stone-900">Pet sitting</p>
              <RoleSwitcher role={route.role} />
            </>
          }
          nav={route.role === "sitter" ? <SitterNav route={route} /> : null}
          screenKey={routeToHash(route)}
        >
          <Screen route={route} />
        </PhoneFrame>

        {/* Панель прототипа живёт за пределами рамки и выглядит как приборы, а
            не как продукт: моноширинный шрифт и пунктир — граница между тем,
            что мы проверяем, и тем, чем проверяем. */}
        <aside className="w-full max-w-md border border-dashed border-stone-400/70 bg-white/70 p-4 font-mono lg:sticky lg:top-10 lg:w-80">
          <p className="mb-3 flex items-center gap-2 text-eyebrow text-stone-500 uppercase">
            <span className="size-1.5 shrink-0 rounded-full bg-stone-400" aria-hidden="true" />
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
      return <EarningsScreen focusBookingId={route.bookingId} />;
  }
}
