import { SEED_SITTER_ID } from "../domain/seed";
import type { Booking, DomainState } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatMoney } from "../domain/money";
import { bookingTotalMinor } from "../domain/earnings";
import { routeToHash } from "../app/routes";
import { formatDateRange, slotsLabel, statusText, statusTone } from "../app/format";
import { EmptyState, ScreenTitle } from "../app/ui";

/**
 * Список броней ситтера. Входящие запросы первой группой — на них он отвечает
 * раньше всего, и до ответа бронь никуда не двигается.
 */
export function SitterBookingsScreen() {
  const { state } = useStore();
  const bookings = Object.values(state.bookings)
    .filter((booking) => booking.sitterId === SEED_SITTER_ID)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const groups = [
    {
      title: "Incoming requests",
      items: bookings.filter((booking) => booking.status === "requested"),
    },
    {
      title: "Active",
      items: bookings.filter((booking) =>
        ["confirmed", "readyToStart", "inProgress", "terminatedEarly", "awaitingHandback", "disputed"].includes(
          booking.status,
        ),
      ),
    },
    {
      title: "Closed",
      items: bookings.filter((booking) =>
        ["completed", "declined", "cancelled"].includes(booking.status),
      ),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      <ScreenTitle hint="Requests first — nothing moves until you answer">Bookings</ScreenTitle>

      {bookings.length === 0 ? (
        <EmptyState>No bookings yet. Requests from families show up here.</EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-xs font-medium tracking-wide text-stone-400 uppercase">
                {group.title} · {group.items.length}
              </p>
              <div className="flex flex-col gap-2">
                {group.items.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} state={state} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BookingRow({ booking, state }: { booking: Booking; state: DomainState }) {
  const pet = state.pets[booking.petId];
  const family = state.families[booking.familyId];

  return (
    <a
      href={routeToHash({ role: "sitter", screen: "booking", bookingId: booking.id })}
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
        {pet.name} · {family.name}
      </p>
      <p className="mt-1 text-sm text-stone-500">
        {slotsLabel(booking.slots)} · {formatMoney(bookingTotalMinor(state, booking.id))}
      </p>
    </a>
  );
}
