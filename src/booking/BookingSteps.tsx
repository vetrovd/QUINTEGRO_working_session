import { missingReadinessSteps } from "../domain/guards";
import type { Booking, Role } from "../domain/types";
import { KeyHandoverPanel } from "./KeyHandoverPanel";
import { MeetGreetPanel } from "./MeetGreetPanel";

/**
 * Шаги, которые бронь проходит до старта опеки. Пока их не пройдут, бронь
 * не уходит в «готова к старту», и в шапке видно, чего именно не хватает.
 */
export function BookingSteps({ booking, role }: { booking: Booking; role: Role }) {
  const missing = missingReadinessSteps(booking);
  const active = booking.status === "confirmed" || booking.status === "readyToStart";
  if (!active && booking.status !== "inProgress") return null;

  return (
    <div className="mt-4 border-t border-stone-200 pt-4">
      {missing.length > 0 ? (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          До старта не хватает: {missing.join(", ")}.
        </p>
      ) : (
        <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {booking.status === "inProgress"
            ? "Опека идёт: ключи переданы, знакомство состоялось."
            : "Всё готово к старту: знакомство состоялось, ключи переданы."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <MeetGreetPanel booking={booking} role={role} />
        <KeyHandoverPanel booking={booking} role={role} direction="handover" />
      </div>
    </div>
  );
}
