import { useStore } from "../store/StoreProvider";
import { balanceOfSitter } from "../domain/earnings";
import { SEED_SITTER_ID } from "../domain/seed";
import { openVisitsCount, pendingRequestsCount } from "../domain/attention";
import { routeToHash } from "./routes";
import type { Route } from "./routes";

/**
 * Нижнее меню ситтера. Отметка на пункте отвечает на вопрос «куда мне сейчас»,
 * не заставляя обходить разделы руками; её значение считает домен.
 */
export function SitterNav({ route }: { route: Route }) {
  const { state, now } = useStore();

  const items = [
    {
      screen: "bookings" as const,
      label: "Bookings",
      href: routeToHash({ role: "sitter", screen: "bookings" }),
      badge: pendingRequestsCount(state, SEED_SITTER_ID),
    },
    {
      screen: "schedule" as const,
      label: "Schedule",
      href: routeToHash({ role: "sitter", screen: "schedule" }),
      badge: openVisitsCount(state, SEED_SITTER_ID, now),
    },
    {
      screen: "earnings" as const,
      label: "Earnings",
      href: routeToHash({ role: "sitter", screen: "earnings" }),
      badge: balanceOfSitter(state, SEED_SITTER_ID).available.count,
    },
  ];

  // Экран одной брони принадлежит разделу Bookings — он и подсвечен.
  const active = route.screen === "booking" ? "bookings" : route.screen;

  return (
    <ul className="flex">
      {items.map((item) => (
        <li key={item.screen} className="flex-1">
          <a
            href={item.href}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
              active === item.screen ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {item.label}
              {item.badge > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </span>
            <span
              className={`h-0.5 w-6 rounded-full ${
                active === item.screen ? "bg-stone-900" : "bg-transparent"
              }`}
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
