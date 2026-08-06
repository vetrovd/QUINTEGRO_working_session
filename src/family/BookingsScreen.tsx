import { awaitsFamilyAction } from "../domain/attention";
import { bookingTotalMinor } from "../domain/earnings";
import { formatMoney } from "../domain/money";
import { unreadReportsCount } from "../domain/reports";
import { SEED_FAMILY_ID } from "../domain/seed";
import type { Booking, DomainState } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateRange, plural, statusText, statusTone } from "../app/format";
import { routeToHash } from "../app/routes";
import { EmptyState, ScreenTitle } from "../app/ui";

/**
 * Стартовый экран семьи: сначала положение дел, потом действие. Отметки на
 * строке отвечают на вопрос «где меня ждут», чтобы не открывать каждую бронь.
 */
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
        <EmptyState>
          No bookings yet. Book a sitter to set up visits while you're away — you'll agree on a meet
          &amp; greet and key handoff before care starts.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {bookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} state={state} />
          ))}
        </ul>
      )}
    </>
  );
}

function BookingRow({ booking, state }: { booking: Booking; state: DomainState }) {
  const sitter = state.sitters[booking.sitterId];
  const unread = unreadReportsCount(state, booking.id);
  const waiting = awaitsFamilyAction(state, booking.id);

  return (
    <li>
      <a
        href={routeToHash({ role: "family", screen: "booking", bookingId: booking.id })}
        className="block rounded-lg border border-stone-200 bg-white p-3 transition hover:border-stone-400"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-stone-900">
            {formatDateRange(booking.startDate, booking.endDate)}
          </p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(booking.status)}`}
          >
            {statusText(booking.status)}
          </span>
        </div>

        <p className="mt-1 text-sm text-stone-500">
          {sitter.name} · {formatMoney(bookingTotalMinor(state, booking.id))}
        </p>

        {(waiting || unread > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {waiting && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                Waiting on you
              </span>
            )}
            {unread > 0 && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-900">
                {plural(unread, "new update")}
              </span>
            )}
          </div>
        )}
      </a>
    </li>
  );
}
