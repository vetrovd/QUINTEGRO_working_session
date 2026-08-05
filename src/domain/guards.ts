import { today } from "./dates";
import type {
  Booking,
  BookingId,
  BookingStatus,
  DomainState,
  IsoDateTime,
  KeyHandoverDirection,
  Role,
  VisitId,
} from "./types";

/**
 * Guard возвращает причину отказа, а не просто false: интерфейс обязан
 * показывать, почему действие недоступно (ADR 0002 — дырку в модели видно
 * как заблокированную кнопку с объяснением).
 */
export type Guard = { allowed: true } | { allowed: false; reason: string };

const allow: Guard = { allowed: true };
const deny = (reason: string): Guard => ({ allowed: false, reason });

export function statusLabel(status: BookingStatus): string {
  switch (status) {
    case "requested":
      return "ожидает ответа";
    case "confirmed":
      return "принята";
    case "readyToStart":
      return "готова к старту";
    case "inProgress":
      return "в работе";
    case "declined":
      return "отклонена";
    case "cancelled":
      return "отменена";
  }
}

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
  if (booking.status === "inProgress") {
    return deny("Опека уже началась — нужно досрочное прерывание");
  }
  return allow;
}

// --- MeetGreet ---------------------------------------------------------------

export function canProposeMeetGreet(state: DomainState, bookingId: BookingId, by: Role): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Бронь не найдена");
  const active = requireActiveBooking(booking);
  if (!active.allowed) return active;
  if (booking.meetGreet.status === "skipped") return deny("Вы уже знакомы — знакомство не нужно");
  if (booking.meetGreet.status === "happened") return deny("Знакомство уже состоялось");
  if (booking.meetGreet.status === "accepted") return deny("Время знакомства уже согласовано");
  if (booking.meetGreet.status === "proposed" && booking.meetGreet.proposedBy === by) {
    return deny("Ваше предложение уже отправлено — ждём ответа второй стороны");
  }
  return allow;
}

export function canAcceptMeetGreet(state: DomainState, bookingId: BookingId, by: Role): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Бронь не найдена");
  if (booking.meetGreet.status !== "proposed") return deny("Нет предложения, которое можно принять");
  if (booking.meetGreet.proposedBy === by) return deny("Своё же предложение принять нельзя");
  return allow;
}

export function canMarkMeetGreetHappened(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Бронь не найдена");
  if (booking.meetGreet.status === "happened") return deny("Знакомство уже отмечено состоявшимся");
  if (booking.meetGreet.status !== "accepted") return deny("Сначала согласуйте время знакомства");
  return allow;
}

// --- KeyHandover -------------------------------------------------------------

export function canProposeKeyHandover(
  state: DomainState,
  bookingId: BookingId,
  direction: KeyHandoverDirection,
  by: Role,
): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Бронь не найдена");
  const active = requireActiveBooking(booking);
  if (!active.allowed) return active;
  const handover = booking.keys[direction];
  if (handover.status === "done") return deny("Передача уже состоялась");
  if (handover.status === "proposed" && handover.proposedBy === by) {
    return deny("Ваше предложение уже отправлено — ждём подтверждения второй стороны");
  }
  if (direction === "return" && booking.status !== "inProgress") {
    return deny("Ключи возвращают в конце опеки");
  }
  return allow;
}

export function canConfirmKeyHandover(
  state: DomainState,
  bookingId: BookingId,
  direction: KeyHandoverDirection,
  by: Role,
): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Бронь не найдена");
  const handover = booking.keys[direction];
  if (handover.status === "pending") return deny("Сначала согласуйте время и способ передачи");
  if (handover.status === "done") return deny("Передача уже состоялась");
  if (confirmedBy(booking, direction, by)) return deny("Вы уже подтвердили передачу");
  return allow;
}

export function confirmedBy(
  booking: Booking,
  direction: KeyHandoverDirection,
  role: Role,
): boolean {
  const handover = booking.keys[direction];
  return role === "family" ? handover.confirmedByFamily : handover.confirmedBySitter;
}

/** Кого ждём — это и есть ответ на «почему передача ещё не состоялась». */
export function awaitingConfirmationFrom(
  booking: Booking,
  direction: KeyHandoverDirection,
): Role[] {
  const handover = booking.keys[direction];
  if (handover.status !== "proposed") return [];
  const waiting: Role[] = [];
  if (!handover.confirmedByFamily) waiting.push("family");
  if (!handover.confirmedBySitter) waiting.push("sitter");
  return waiting;
}

// --- Готовность брони и визиты ----------------------------------------------

export function meetGreetSettled(booking: Booking): boolean {
  return booking.meetGreet.status === "happened" || booking.meetGreet.status === "skipped";
}

/** Чего не хватает броне до старта — списком, для карточки брони. */
export function missingReadinessSteps(booking: Booking): string[] {
  const missing: string[] = [];
  if (!meetGreetSettled(booking)) missing.push("знакомство с семьёй и питомцем");
  if (booking.keys.handover.status !== "done") missing.push("передача ключей");
  return missing;
}

export function canCheckIn(state: DomainState, visitId: VisitId, now: IsoDateTime): Guard {
  const visit = state.visits[visitId];
  if (!visit) return deny("Визит не найден");
  if (visit.status === "cancelled") return deny("Визит отменён");
  if (visit.status === "checkedIn") return deny("Приход уже отмечен");

  const booking = state.bookings[visit.bookingId];
  if (booking.keys.handover.status !== "done") {
    return deny("Передача ключей не подтверждена обеими сторонами — доступа в дом нет");
  }
  if (!meetGreetSettled(booking)) return deny("Знакомство ещё не состоялось");
  if (visit.date > today(now)) return deny("Визит ещё не наступил");
  return allow;
}

function requireActiveBooking(booking: Booking): Guard {
  if (booking.status === "declined") return deny("Ситтер отклонил бронь");
  if (booking.status === "cancelled") return deny("Бронь отменена");
  if (booking.status === "requested") return deny("Ситтер ещё не принял бронь");
  return allow;
}
