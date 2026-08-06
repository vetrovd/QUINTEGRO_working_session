import { awaitsFamilyAction } from "../domain/attention";
import { bookingTotalMinor } from "../domain/earnings";
import { formatMoney } from "../domain/money";
import { unreadReportsCount } from "../domain/reports";
import { SEED_FAMILY_ID } from "../domain/seed";
import type { Booking, DomainState } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateRange, plural } from "../app/format";
import { routeToHash } from "../app/routes";
import { EmptyState, RowLink, ScreenTitle, StatusChip } from "../app/ui";

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

      {/* Главное действие экрана — единственное место акцента на нём. */}
      <a
        href={routeToHash({ role: "family", screen: "newBooking" })}
        className="mb-6 block rounded-lg bg-accent px-4 py-2.5 text-center text-body font-medium text-white transition hover:bg-accent-strong"
      >
        Book a sitter
      </a>

      {bookings.length === 0 ? (
        <EmptyState>
          No bookings yet. Book a sitter to set up visits while you're away — you'll agree on a meet
          &amp; greet and key handoff before care starts.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
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
      <RowLink href={routeToHash({ role: "family", screen: "booking", bookingId: booking.id })}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-body font-semibold text-stone-900">
            {formatDateRange(booking.startDate, booking.endDate)}
          </p>
          <StatusChip status={booking.status} />
        </div>

        <p className="mt-1 text-meta text-stone-500">
          {sitter.name} · {formatMoney(bookingTotalMinor(state, booking.id))}
        </p>

        {(waiting || unread > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {waiting && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-meta font-medium text-amber-900">
                Waiting on you
              </span>
            )}
            {unread > 0 && (
              <span className="rounded-full bg-stone-800 px-2.5 py-1 text-meta font-medium text-white">
                {plural(unread, "new update")}
              </span>
            )}
          </div>
        )}
      </RowLink>
    </li>
  );
}
