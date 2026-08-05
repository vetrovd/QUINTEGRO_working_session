import { canCancelBooking, canRespondToBooking } from "./guards";
import type { Booking, DomainEvent, DomainState, IsoDateTime, JournalEntry } from "./types";

export interface ReduceContext {
  now: IsoDateTime;
}

/**
 * Единственное место, где происходят переходы состояний (ADR 0002).
 * Чистая функция: время приходит извне, компоненты сюда не заглядывают.
 *
 * Недопустимый переход не бросает исключение и не меняет состояние — он
 * попадает в журнал как отклонённый. Guard'ы не дают интерфейсу отправить
 * такое событие, но если это произошло, потеряться оно не должно.
 */
export function reduce(state: DomainState, event: DomainEvent, ctx: ReduceContext): DomainState {
  switch (event.type) {
    case "BookingRequested": {
      if (state.bookings[event.bookingId]) {
        return reject(state, event, ctx, "Бронь с таким идентификатором уже существует");
      }
      const booking: Booking = {
        id: event.bookingId,
        familyId: event.familyId,
        sitterId: event.sitterId,
        petId: event.petId,
        startDate: event.startDate,
        endDate: event.endDate,
        slots: event.slots,
        ratePerVisitMinor: event.ratePerVisitMinor,
        status: "requested",
        requestedAt: ctx.now,
      };
      return commit(state, event, ctx, {
        bookings: { ...state.bookings, [booking.id]: booking },
      });
    }

    case "BookingAccepted": {
      const guard = canRespondToBooking(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      return commitBooking(state, event, ctx, {
        ...state.bookings[event.bookingId],
        status: "confirmed",
        respondedAt: ctx.now,
      });
    }

    case "BookingDeclined": {
      const guard = canRespondToBooking(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      return commitBooking(state, event, ctx, {
        ...state.bookings[event.bookingId],
        status: "declined",
        respondedAt: ctx.now,
        declineReason: event.reason,
      });
    }

    case "BookingCancelled": {
      const guard = canCancelBooking(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      return commitBooking(state, event, ctx, {
        ...state.bookings[event.bookingId],
        status: "cancelled",
        cancelledAt: ctx.now,
      });
    }
  }
}

/** Последовательность событий — удобно и для тестов, и для сид-данных. */
export function reduceAll(
  state: DomainState,
  events: DomainEvent[],
  ctx: ReduceContext,
): DomainState {
  return events.reduce((acc, event) => reduce(acc, event, ctx), state);
}

function commit(
  state: DomainState,
  event: DomainEvent,
  ctx: ReduceContext,
  patch: Partial<DomainState>,
): DomainState {
  return { ...state, ...patch, journal: [...state.journal, entry(event, ctx)] };
}

function commitBooking(
  state: DomainState,
  event: DomainEvent,
  ctx: ReduceContext,
  booking: Booking,
): DomainState {
  return commit(state, event, ctx, { bookings: { ...state.bookings, [booking.id]: booking } });
}

function reject(
  state: DomainState,
  event: DomainEvent,
  ctx: ReduceContext,
  rejection: string,
): DomainState {
  return { ...state, journal: [...state.journal, { ...entry(event, ctx), rejection }] };
}

function entry(event: DomainEvent, ctx: ReduceContext): JournalEntry {
  return { at: ctx.now, event };
}
