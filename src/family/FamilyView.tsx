import { canCancelBooking } from "../domain/guards";
import { SEED_FAMILY_ID } from "../domain/seed";
import { useStore } from "../store/StoreProvider";
import { BookingCard } from "../app/BookingCard";
import { EmptyState, GuardedButton, SectionTitle } from "../app/ui";
import { BookingRequestForm } from "./BookingRequestForm";

export function FamilyView() {
  const { state, dispatch } = useStore();
  const bookings = Object.values(state.bookings)
    .filter((booking) => booking.familyId === SEED_FAMILY_ID)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  return (
    <div className="flex flex-col gap-8">
      <BookingRequestForm />

      <section>
        <SectionTitle hint="Статус виден сразу, как ситтер ответит">Мои брони</SectionTitle>
        {bookings.length === 0 ? (
          <EmptyState>Броней пока нет. Отправьте запрос ситтеру выше.</EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                state={state}
                actions={
                  <GuardedButton
                    tone="danger"
                    guard={canCancelBooking(state, booking.id)}
                    onClick={() => dispatch({ type: "BookingCancelled", bookingId: booking.id })}
                  >
                    Отменить бронь
                  </GuardedButton>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
