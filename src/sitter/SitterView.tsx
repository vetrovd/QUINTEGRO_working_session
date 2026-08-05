import { useState } from "react";
import { canRespondToBooking } from "../domain/guards";
import { SEED_SITTER_ID } from "../domain/seed";
import type { BookingId } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { BookingCard } from "../app/BookingCard";
import { EmptyState, GuardedButton, SectionTitle, inputClass } from "../app/ui";
import { BookingSteps } from "../booking/BookingSteps";
import { VisitSchedule } from "./VisitSchedule";

export function SitterView() {
  const { state } = useStore();
  const bookings = Object.values(state.bookings)
    .filter((booking) => booking.sitterId === SEED_SITTER_ID)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const incoming = bookings.filter((booking) => booking.status === "requested");
  const active = bookings.filter((booking) =>
    ["confirmed", "readyToStart", "inProgress"].includes(booking.status),
  );
  const closed = bookings.filter((booking) =>
    ["declined", "cancelled"].includes(booking.status),
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle hint="Даты, слоты, адрес, питомец и ставка — всё, чтобы решить сразу">
          Входящие запросы
        </SectionTitle>
        {incoming.length === 0 ? (
          <EmptyState>Новых запросов нет.</EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {incoming.map((booking) => (
              <BookingCard key={booking.id} booking={booking} state={state}>
                <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
                  <span className="font-medium">Уход: </span>
                  {state.pets[booking.petId].careNotes}
                </p>
                <RespondActions bookingId={booking.id} />
              </BookingCard>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle hint="Согласования до старта опеки">Текущие брони</SectionTitle>
        {active.length === 0 ? (
          <EmptyState>Принятых броней нет.</EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {active.map((booking) => (
              <BookingCard key={booking.id} booking={booking} state={state}>
                <BookingSteps booking={booking} role="sitter" />
              </BookingCard>
            ))}
          </div>
        )}
      </section>

      <VisitSchedule />

      {closed.length > 0 && (
        <section>
          <SectionTitle>Закрытые</SectionTitle>
          <div className="flex flex-col gap-4">
            {closed.map((booking) => (
              <BookingCard key={booking.id} booking={booking} state={state} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RespondActions({ bookingId }: { bookingId: BookingId }) {
  const { state, dispatch } = useStore();
  const [reason, setReason] = useState("");
  const guard = canRespondToBooking(state, bookingId);

  return (
    <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-stone-200 pt-4">
      <GuardedButton guard={guard} onClick={() => dispatch({ type: "BookingAccepted", bookingId })}>
        Принять
      </GuardedButton>
      <input
        type="text"
        value={reason}
        placeholder="Причина отказа (необязательно)"
        onChange={(event) => setReason(event.target.value)}
        className={`${inputClass} min-w-56 flex-1`}
      />
      <GuardedButton
        tone="danger"
        guard={guard}
        onClick={() =>
          dispatch({ type: "BookingDeclined", bookingId, reason: reason.trim() || undefined })
        }
      >
        Отклонить
      </GuardedButton>
    </div>
  );
}
