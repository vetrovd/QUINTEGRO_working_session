import { HOUR_MS } from "./clock";
import { earningsOfBooking } from "./earnings";
import type { Booking, BookingId, DomainState, IsoDateTime } from "./types";
import { visitsOfBooking } from "./visits";

/**
 * Окно ответа семьи на заявку о сдаче работы. Молчание считается согласием —
 * без этого молчание семьи оставляет ситтера без денег, а бронь незакрытой
 * навсегда (ADR 0001). Задано здесь и только здесь.
 */
export const HANDBACK_WINDOW_HOURS = 48;

/** Момент, когда бронь закроется сама. Есть только у брони на подтверждении. */
export function handbackDeadline(booking: Booking): IsoDateTime | undefined {
  if (booking.status !== "awaitingHandback" || !booking.handbackRequestedAt) return undefined;
  return new Date(
    Date.parse(booking.handbackRequestedAt) + HANDBACK_WINDOW_HOURS * HOUR_MS,
  ).toISOString();
}

/** Сколько осталось от окна. Ноль — окно истекло. */
export function handbackTimeLeftMs(booking: Booking, now: IsoDateTime): number {
  const deadline = handbackDeadline(booking);
  if (!deadline) return 0;
  return Math.max(0, Date.parse(deadline) - Date.parse(now));
}

/**
 * Брони, которые к моменту now должны были закрыться сами. Функция чистая, а
 * события авто-подтверждения отправляет уже хранилище: время не должно
 * протекать внутрь редьюсера иначе, чем через событие (ADR 0002).
 */
export function expiredHandbacks(state: DomainState, now: IsoDateTime): BookingId[] {
  return Object.values(state.bookings)
    .filter((booking) => {
      const deadline = handbackDeadline(booking);
      return deadline !== undefined && Date.parse(now) >= Date.parse(deadline);
    })
    .map((booking) => booking.id);
}

/**
 * Сводка, по которой семья решает, подтверждать ли закрытие: сколько визитов
 * состоялось, сколько нет, и какая сумма из этого выходит.
 */
export interface HandbackSummary {
  /** Все визиты, на которые разворачивался период. */
  planned: number;
  completed: number;
  /** Визиты, которые ситтер отметил не состоявшимися. */
  missed: number;
  /** Визиты, снятые отменой брони или досрочным прерыванием. */
  cancelled: number;
  /** Ни отчёта, ни отметки: визит просто остался в плане. */
  unaccounted: number;
  grossMinor: number;
  feeMinor: number;
  netMinor: number;
}

export function handbackSummary(state: DomainState, bookingId: BookingId): HandbackSummary {
  const visits = visitsOfBooking(state, bookingId);
  const earnings = earningsOfBooking(state, bookingId);
  const count = (status: string) => visits.filter((visit) => visit.status === status).length;
  const sum = (pick: (item: (typeof earnings)[number]) => number) =>
    earnings.reduce((total, item) => total + pick(item), 0);

  const completed = count("completed");
  const missed = count("missed");
  const cancelled = count("cancelled");

  return {
    planned: visits.length,
    completed,
    missed,
    cancelled,
    unaccounted: visits.length - completed - missed - cancelled,
    grossMinor: sum((item) => item.grossMinor),
    feeMinor: sum((item) => item.feeMinor),
    netMinor: sum((item) => item.netMinor),
  };
}
