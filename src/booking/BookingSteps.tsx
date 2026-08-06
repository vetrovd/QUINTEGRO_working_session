import { missingReadinessSteps } from "../domain/guards";
import type { Booking, Role } from "../domain/types";
import { HandbackPanel } from "./HandbackPanel";
import { KeyHandoverPanel } from "./KeyHandoverPanel";
import { MeetGreetPanel } from "./MeetGreetPanel";
import { TerminatePanel } from "./TerminatePanel";

/**
 * Весь путь брони одним списком: знакомство и передача ключей до старта,
 * возврат ключей и сдача работы на закрытии. Пока шаг не пройден, бронь не
 * двигается дальше, и в шапке видно, чего именно не хватает.
 */
export function BookingSteps({ booking, role }: { booking: Booking; role: Role }) {
  const preparing = booking.status === "confirmed" || booking.status === "readyToStart";
  const closing =
    booking.status === "inProgress" ||
    booking.status === "terminatedEarly" ||
    booking.status === "awaitingHandback" ||
    booking.status === "completed" ||
    booking.status === "disputed";
  if (!preparing && !closing) return null;

  const banner = bannerOf(booking);

  return (
    <div className="mt-4 border-t border-stone-200 pt-4">
      <p className={`mb-3 rounded-md px-3 py-2 text-sm ${banner.tone}`}>{banner.text}</p>

      <div className="flex flex-col gap-3">
        <MeetGreetPanel booking={booking} role={role} />
        <KeyHandoverPanel booking={booking} role={role} direction="handover" />
        {closing && (
          <>
            <TerminatePanel booking={booking} role={role} />
            <KeyHandoverPanel booking={booking} role={role} direction="return" />
            <HandbackPanel booking={booking} role={role} />
          </>
        )}
      </div>
    </div>
  );
}

const AMBER = "bg-amber-50 text-amber-900";
const EMERALD = "bg-emerald-50 text-emerald-900";
const RED = "bg-red-50 text-red-900";

function bannerOf(booking: Booking): { tone: string; text: string } {
  switch (booking.status) {
    case "awaitingHandback":
      return { tone: AMBER, text: "Работа сдана — ждём подтверждения семьи." };
    case "disputed":
      return {
        tone: RED,
        text: "Открыт спор: бронь не закрыта, деньги ситтера заблокированы до разбора.",
      };
    case "completed":
      return { tone: EMERALD, text: "Опека закрыта: ключи возвращены, работа принята." };
    case "inProgress":
      return { tone: EMERALD, text: "Опека идёт: ключи переданы, знакомство состоялось." };
    case "terminatedEarly":
      return {
        tone: AMBER,
        text: "Опека прервана досрочно — бронь ещё нужно закрыть: вернуть ключи и сдать работу.",
      };
    default: {
      const missing = missingReadinessSteps(booking);
      return missing.length > 0
        ? { tone: AMBER, text: `До старта не хватает: ${missing.join(", ")}.` }
        : { tone: EMERALD, text: "Всё готово к старту: знакомство состоялось, ключи переданы." };
    }
  }
}
