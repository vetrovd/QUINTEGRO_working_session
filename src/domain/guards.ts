import { today } from "./dates";
import { earningOfVisit } from "./earnings";
import { handbackTimeLeftMs } from "./handback";
import { isReportEmpty } from "./reports";
import type {
  Booking,
  BookingId,
  BookingStatus,
  DomainState,
  IsoDateTime,
  KeyHandoverDirection,
  Role,
  SitterId,
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
    case "awaitingHandback":
      return "ждёт подтверждения закрытия";
    case "completed":
      return "опека закрыта";
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
  if (booking.status === "completed") return deny("Опека закрыта — отменять нечего");
  if (booking.status === "inProgress" || booking.status === "awaitingHandback") {
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
  if (visit.status === "completed") return deny("Визит уже завершён");
  if (visit.status === "checkedIn") return deny("Приход уже отмечен");

  const booking = state.bookings[visit.bookingId];
  // После заявки на сдачу работы новых визитов быть не может: иначе набор
  // начислений менялся бы после того, как семья подтвердила сумму.
  if (booking.status === "awaitingHandback") {
    return deny("Работа сдана на подтверждение — ключи уже возвращены");
  }
  if (booking.status === "completed") return deny("Опека закрыта");
  if (booking.keys.handover.status !== "done") {
    return deny("Передача ключей не подтверждена обеими сторонами — доступа в дом нет");
  }
  if (!meetGreetSettled(booking)) return deny("Знакомство ещё не состоялось");
  if (visit.date > today(now)) return deny("Визит ещё не наступил");
  return allow;
}

// --- Отчёты ------------------------------------------------------------------

export function canSaveVisitReport(state: DomainState, visitId: VisitId): Guard {
  const visit = state.visits[visitId];
  if (!visit) return deny("Визит не найден");
  if (visit.status === "cancelled") return deny("Визит отменён");
  if (state.reports[visitId]?.status === "submitted") {
    return deny("Отчёт отправлен — изменить его нельзя");
  }
  if (visit.status === "scheduled") return deny("Сначала отметьте приход на визит");
  return allow;
}

export function canSubmitVisitReport(state: DomainState, visitId: VisitId): Guard {
  const saveable = canSaveVisitReport(state, visitId);
  if (!saveable.allowed) return saveable;
  const report = state.reports[visitId];
  if (!report) return deny("Заполните отчёт перед отправкой");
  if (isReportEmpty(report)) {
    return deny("Отметьте выполненные задачи, приложите фото или напишите заметку");
  }
  return allow;
}

// --- Handback ----------------------------------------------------------------

/**
 * Заявка на сдачу работы. Возврат ключей — такой же двусторонний шаг, как
 * передача: пока обе стороны его не подтвердили, сдавать нечего. Визиты с
 * отмеченным приходом должны быть закрыты отчётом до заявки — иначе визит
 * остался бы без начисления, а деньги уже разблокировались бы.
 */
export function canRequestHandback(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Бронь не найдена");
  if (booking.status === "awaitingHandback") {
    return deny("Заявка уже отправлена — ждём подтверждения семьи");
  }
  if (booking.status === "completed") return deny("Опека уже закрыта");
  if (booking.status !== "inProgress") {
    return deny(`Опека ещё не началась: бронь в статусе «${statusLabel(booking.status)}»`);
  }
  if (booking.keys.return.status !== "done") {
    return deny("Возврат ключей не подтверждён обеими сторонами");
  }
  const open = Object.values(state.visits).filter(
    (visit) => visit.bookingId === bookingId && visit.status === "checkedIn",
  );
  if (open.length > 0) {
    return deny(`Сдайте отчёт по визиту, где отмечен приход (${open.length})`);
  }
  return allow;
}

/** Подтверждение семьи — единственная точка разблокировки денег (ADR 0001). */
export function canConfirmHandback(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Бронь не найдена");
  if (booking.status === "completed") return deny("Бронь уже закрыта");
  if (booking.status !== "awaitingHandback") {
    return deny("Ситтер ещё не заявил сдачу работы");
  }
  return allow;
}

/**
 * Молчание семьи закрывает бронь только после дедлайна. Подтверждение внутри
 * окна выводит бронь из awaitingHandback, и таймаут уже не сработает.
 */
export function canAutoConfirmHandback(
  state: DomainState,
  bookingId: BookingId,
  now: IsoDateTime,
): Guard {
  const confirmable = canConfirmHandback(state, bookingId);
  if (!confirmable.allowed) return confirmable;
  if (handbackTimeLeftMs(state.bookings[bookingId], now) > 0) {
    return deny("Окно ответа семьи ещё не истекло");
  }
  return allow;
}

// --- Payout ------------------------------------------------------------------

/**
 * Инвариант 5 «вывод не превышает доступное» проверяется поштучно: вывод — это
 * набор начислений, поэтому достаточно, чтобы каждое входящее начисление было
 * доступным и не выведенным. Сумму сверять не нужно, превысить нечем.
 */
export function canRequestPayout(
  state: DomainState,
  sitterId: SitterId,
  visitIds: VisitId[],
): Guard {
  if (visitIds.length === 0) return deny("Выберите визиты для вывода");
  if (new Set(visitIds).size !== visitIds.length) return deny("Визит указан в выводе дважды");

  for (const visitId of visitIds) {
    const earning = earningOfVisit(state, visitId);
    if (!earning) return deny("По визиту нет начисления");
    if (earning.sitterId !== sitterId) return deny("Начисление другого ситтера");
    if (earning.status === "locked") {
      return deny("Деньги за визит заблокированы — семья не подтвердила закрытие брони");
    }
    if (earning.status === "paidOut") return deny("Деньги за визит уже выведены");
  }
  return allow;
}

export function canMarkReportRead(state: DomainState, visitId: VisitId): Guard {
  const report = state.reports[visitId];
  if (!report || report.status !== "submitted") return deny("Отчёт ещё не сдан");
  if (report.readByFamilyAt) return deny("Отчёт уже прочитан");
  return allow;
}

function requireActiveBooking(booking: Booking): Guard {
  if (booking.status === "declined") return deny("Ситтер отклонил бронь");
  if (booking.status === "cancelled") return deny("Бронь отменена");
  if (booking.status === "requested") return deny("Ситтер ещё не принял бронь");
  if (booking.status === "completed") return deny("Опека закрыта");
  return allow;
}
