import type { BookingId, DomainState } from "./types";

/**
 * Guard возвращает причину отказа, а не просто false: интерфейс обязан
 * показывать, почему действие недоступно (ADR 0002 — дырку в модели видно
 * как заблокированную кнопку с объяснением).
 */
export type Guard = { allowed: true } | { allowed: false; reason: string };

const allow: Guard = { allowed: true };
const deny = (reason: string): Guard => ({ allowed: false, reason });

export function canRespondToBooking(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Бронь не найдена");
  if (booking.status !== "requested") {
    return deny(`Ответ уже не нужен: бронь в статусе «${statusLabel(booking.status)}»`);
  }
  return allow;
}

export function canCancelBooking(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Бронь не найдена");
  if (booking.status === "declined") return deny("Ситтер отклонил бронь — отменять нечего");
  if (booking.status === "cancelled") return deny("Бронь уже отменена");
  return allow;
}

export function statusLabel(status: DomainState["bookings"][string]["status"]): string {
  switch (status) {
    case "requested":
      return "ожидает ответа";
    case "confirmed":
      return "принята";
    case "declined":
      return "отклонена";
    case "cancelled":
      return "отменена";
  }
}
