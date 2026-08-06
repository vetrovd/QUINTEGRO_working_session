import { SEED_SITTER_ID } from "../domain/seed";
import type { Booking, DomainState } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatMoney } from "../domain/money";
import { bookingTotalMinor } from "../domain/earnings";
import { routeToHash } from "../app/routes";
import { formatDateRange, slotsLabel } from "../app/format";
import { EmptyState, Eyebrow, RowLink, ScreenTitle, StatusChip } from "../app/ui";

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
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.title}>
              <Eyebrow>
                {group.title} · {group.items.length}
              </Eyebrow>
              <div className="flex flex-col gap-2.5">
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
    <RowLink href={routeToHash({ role: "sitter", screen: "booking", bookingId: booking.id })}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-body font-semibold text-stone-900">
          {formatDateRange(booking.startDate, booking.endDate)}
        </p>
        <StatusChip status={booking.status} />
      </div>
      <p className="mt-1 text-meta text-stone-500">
        {pet.name} · {family.name}
      </p>
      <p className="mt-0.5 text-meta text-stone-500">
        {slotsLabel(booking.slots)} · <span className="tabular-nums">{formatMoney(bookingTotalMinor(state, booking.id))}</span>
      </p>
    </RowLink>
  );
}
