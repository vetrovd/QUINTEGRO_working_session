import { busyDates } from "./availability";
import { eachDate, today } from "./dates";
import { earningOfVisit } from "./earnings";
import { handbackTimeLeftMs } from "./handback";
import { isReportEmpty } from "./reports";
import type {
  Booking,
  BookingDraft,
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
      return "awaiting a response";
    case "confirmed":
      return "accepted";
    case "readyToStart":
      return "ready to start";
    case "inProgress":
      return "in progress";
    case "terminatedEarly":
      return "ended early";
    case "awaitingHandback":
      return "awaiting closing confirmation";
    case "completed":
      return "closed";
    case "disputed":
      return "disputed";
    case "declined":
      return "declined";
    case "cancelled":
      return "canceled";
  }
}

/**
 * Заявка на бронь до того, как она стала событием. Проверка живёт в домене по
 * тому же правилу, что и остальные: активность кнопки — это guard, иначе
 * условия отправки расходятся с тем, что принимает редьюсер.
 */
export function canRequestBooking(state: DomainState, draft: BookingDraft): Guard {
  if (!draft.startDate) return deny("Pick the first day of the stay");
  if (!draft.endDate) return deny("Pick the last day of the stay");

  const busy = busyDates(state);
  if (eachDate(draft.startDate, draft.endDate).some((date) => busy.has(date))) {
    return deny("Some days in this range are already booked");
  }
  if (draft.slots.length === 0) return deny("Pick at least one visit a day");
  return allow;
}

export function canRespondToBooking(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Booking not found");
  if (booking.status !== "requested") {
    return deny(`No response needed — this booking is ${statusLabel(booking.status)}`);
  }
  return allow;
}

export function canCancelBooking(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Booking not found");
  if (booking.status === "declined") return deny("The sitter declined — nothing to cancel");
  if (booking.status === "cancelled") return deny("This booking is already canceled");
  if (booking.status === "disputed") return deny(DISPUTE_DEAD_END);
  if (booking.status === "completed") return deny("This booking is closed — nothing to cancel");
  if (
    booking.status === "inProgress" ||
    booking.status === "terminatedEarly" ||
    booking.status === "awaitingHandback"
  ) {
    return deny("Care has already started — end it early instead");
  }
  return allow;
}

/**
 * Досрочное прерывание доступно обеим сторонам: семья вернулась раньше или
 * ситтер выбыл. Отличается от отмены тем, что бронь не исчезает — она всё
 * равно закрывается через Handback, иначе прерывание стало бы дырой в деньгах.
 */
export function canTerminateEarly(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Booking not found");
  if (booking.status === "terminatedEarly") return deny("Care has already been ended early");
  if (booking.status === "disputed") return deny(DISPUTE_DEAD_END);
  if (booking.status === "awaitingHandback") {
    return deny("The work has already been submitted for confirmation");
  }
  if (booking.status === "completed") return deny("This booking is closed — nothing to end");
  if (booking.status !== "inProgress") {
    return deny("Care hasn't started yet — you can simply cancel the booking");
  }
  return allow;
}

// --- MeetGreet ---------------------------------------------------------------

export function canProposeMeetGreet(state: DomainState, bookingId: BookingId, by: Role): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Booking not found");
  const active = requireActiveBooking(booking);
  if (!active.allowed) return active;
  if (booking.meetGreet.status === "skipped") {
    return deny("You've met before — no meet & greet needed");
  }
  if (booking.meetGreet.status === "happened") return deny("The meet & greet already took place");
  if (booking.meetGreet.status === "accepted") return deny("A time is already agreed");
  if (booking.meetGreet.status === "proposed" && booking.meetGreet.proposedBy === by) {
    return deny("Your proposal is already sent — waiting on the other side");
  }
  return allow;
}

export function canAcceptMeetGreet(state: DomainState, bookingId: BookingId, by: Role): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Booking not found");
  if (booking.meetGreet.status !== "proposed") return deny("There's no proposal to accept");
  if (booking.meetGreet.proposedBy === by) return deny("You can't accept your own proposal");
  return allow;
}

export function canMarkMeetGreetHappened(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Booking not found");
  if (booking.meetGreet.status === "happened") {
    return deny("The meet & greet is already marked as done");
  }
  if (booking.meetGreet.status !== "accepted") return deny("Agree on a time first");
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
  if (!booking) return deny("Booking not found");
  const active = requireActiveBooking(booking);
  if (!active.allowed) return active;
  const handover = booking.keys[direction];
  if (handover.status === "done") return deny("The handoff already happened");
  if (handover.status === "proposed" && handover.proposedBy === by) {
    return deny("Your proposal is already sent — waiting on the other side to confirm");
  }
  // Прерванная опека закрывается тем же путём, поэтому ключи возвращают и в ней.
  if (
    direction === "return" &&
    booking.status !== "inProgress" &&
    booking.status !== "terminatedEarly"
  ) {
    return deny("Keys go back at the end of care");
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
  if (!booking) return deny("Booking not found");
  const handover = booking.keys[direction];
  if (handover.status === "pending") return deny("Agree on a time and method first");
  if (handover.status === "done") return deny("The handoff already happened");
  if (confirmedBy(booking, direction, by)) return deny("You've already confirmed this handoff");
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
  if (!meetGreetSettled(booking)) missing.push("the meet & greet");
  if (booking.keys.handover.status !== "done") missing.push("the key handoff");
  return missing;
}

/**
 * Началась ли опека. Условия те же, что у canCheckIn для отдельного визита,
 * но заданы на уровне брони: таймлайну нужна одна причина ожидания на весь
 * шаг, и она должна прийти из домена, а не быть сочинена интерфейсом.
 */
export function canStartCare(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Booking not found");
  if (booking.status === "requested") {
    return deny("The sitter hasn't accepted the request yet");
  }
  if (booking.status === "declined") return deny("The sitter declined this request");
  if (booking.status === "cancelled") return deny("This booking is canceled");

  const missing = missingReadinessSteps(booking);
  if (missing.length > 0) return deny(`Starts after ${andList(missing)}`);
  return allow;
}

/** «a», «a and b», «a, b and c» — причина отказа должна читаться как фраза. */
function andList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function canCheckIn(state: DomainState, visitId: VisitId, now: IsoDateTime): Guard {
  const visit = state.visits[visitId];
  if (!visit) return deny("Visit not found");
  if (visit.status === "cancelled") return deny("This visit is canceled");
  if (visit.status === "missed") return deny("This visit is marked as missed");
  if (visit.status === "completed") return deny("This visit is already done");
  if (visit.status === "checkedIn") return deny("You're already checked in");

  const booking = state.bookings[visit.bookingId];
  // После заявки на сдачу работы новых визитов быть не может: иначе набор
  // начислений менялся бы после того, как семья подтвердила сумму.
  if (booking.status === "awaitingHandback") {
    return deny("The work is submitted for confirmation — the keys are already back");
  }
  if (booking.status === "disputed") return deny(DISPUTE_DEAD_END);
  if (booking.status === "completed") return deny("This booking is closed");
  if (booking.keys.handover.status !== "done") {
    return deny("The key handoff isn't confirmed by both sides — you have no way in");
  }
  if (!meetGreetSettled(booking)) return deny("The meet & greet hasn't happened yet");
  if (visit.date > today(now)) return deny("This visit hasn't come around yet");
  return allow;
}

// --- Отчёты ------------------------------------------------------------------

/**
 * Пропуск визита признаёт ситтер: начисления по такому визиту не будет.
 * Отметку прихода тоже можно признать пропуском — иначе визит с ошибочным
 * приходом остаётся без отчёта и без пропуска, и бронь не закрыть.
 */
export function canMarkVisitMissed(state: DomainState, visitId: VisitId): Guard {
  const visit = state.visits[visitId];
  if (!visit) return deny("Visit not found");
  if (visit.status === "missed") return deny("This visit is already marked as missed");
  if (visit.status === "cancelled") return deny("This visit is canceled");
  if (visit.status === "completed") return deny("The report is filed — this visit happened");

  const booking = state.bookings[visit.bookingId];
  // Набор начислений заморожен с момента заявки на сдачу работы: сводка,
  // которую увидела семья, после этого не меняется.
  if (booking.status === "awaitingHandback") {
    return deny("The work has already been submitted for confirmation");
  }
  if (booking.status === "disputed") return deny(DISPUTE_DEAD_END);
  if (booking.status === "completed") return deny("This booking is closed");
  return allow;
}

export function canSaveVisitReport(state: DomainState, visitId: VisitId): Guard {
  const visit = state.visits[visitId];
  if (!visit) return deny("Visit not found");
  if (visit.status === "cancelled") return deny("This visit is canceled");
  if (visit.status === "missed") return deny("This visit is marked as missed");
  if (state.reports[visitId]?.status === "submitted") {
    return deny("The report is sent — it can't be changed");
  }
  if (visit.status === "scheduled") return deny("Check in to the visit first");
  return allow;
}

export function canSubmitVisitReport(state: DomainState, visitId: VisitId): Guard {
  const saveable = canSaveVisitReport(state, visitId);
  if (!saveable.allowed) return saveable;
  const report = state.reports[visitId];
  if (!report) return deny("Fill in the report before sending it");
  if (isReportEmpty(report)) {
    return deny("Check off what you did, add a photo, or write a note");
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
  if (!booking) return deny("Booking not found");
  if (booking.status === "awaitingHandback") {
    return deny("Already submitted — waiting on the family to confirm");
  }
  if (booking.status === "disputed") return deny(DISPUTE_DEAD_END);
  if (booking.status === "completed") return deny("This booking is already closed");
  // Прерванная досрочно опека сдаётся тем же путём — иначе её нечем закрыть.
  if (booking.status !== "inProgress" && booking.status !== "terminatedEarly") {
    return deny(`Care hasn't started — this booking is ${statusLabel(booking.status)}`);
  }
  if (booking.keys.return.status !== "done") {
    return deny("The key return isn't confirmed by both sides");
  }
  const open = Object.values(state.visits).filter(
    (visit) => visit.bookingId === bookingId && visit.status === "checkedIn",
  );
  if (open.length > 0) {
    return deny(
      `Close the visit you checked in to (${open.length}): file a report or mark it missed`,
    );
  }
  return allow;
}

/**
 * Спор — терминальное состояние прототипа: разбирать его некому, поэтому из
 * него нет ни одного перехода. Причина отказа одна на все выходы.
 */
export const DISPUTE_DEAD_END =
  "A dispute is open — this needs review, and the prototype has no one to do it";

/** Подтверждение семьи — единственная точка разблокировки денег (ADR 0001). */
export function canConfirmHandback(state: DomainState, bookingId: BookingId): Guard {
  const booking = state.bookings[bookingId];
  if (!booking) return deny("Booking not found");
  if (booking.status === "disputed") return deny(DISPUTE_DEAD_END);
  if (booking.status === "completed") return deny("This booking is already closed");
  if (booking.status !== "awaitingHandback") {
    return deny("The sitter hasn't submitted the work yet");
  }
  return allow;
}

/** Оспорить можно только заявленную сдачу работы, и только с причиной. */
export function canDisputeHandback(
  state: DomainState,
  bookingId: BookingId,
  reason: string,
): Guard {
  const confirmable = canConfirmHandback(state, bookingId);
  if (!confirmable.allowed) return confirmable;
  if (reason.trim().length === 0) return deny("Describe what went wrong");
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
    return deny("The family's response window hasn't run out yet");
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
  if (visitIds.length === 0) return deny("Pick visits to cash out");
  if (new Set(visitIds).size !== visitIds.length) return deny("A visit is listed twice");

  for (const visitId of visitIds) {
    const earning = earningOfVisit(state, visitId);
    if (!earning) return deny("This visit has no earning");
    if (earning.sitterId !== sitterId) return deny("This earning belongs to another sitter");
    if (earning.status === "locked") {
      return deny("This visit's money is locked — the family hasn't confirmed closing");
    }
    if (earning.status === "paidOut") return deny("This visit's money is already cashed out");
  }
  return allow;
}

export function canMarkReportRead(state: DomainState, visitId: VisitId): Guard {
  const report = state.reports[visitId];
  if (!report || report.status !== "submitted") return deny("The report isn't filed yet");
  if (report.readByFamilyAt) return deny("This report is already read");
  return allow;
}

function requireActiveBooking(booking: Booking): Guard {
  if (booking.status === "declined") return deny("The sitter declined this booking");
  if (booking.status === "cancelled") return deny("This booking is canceled");
  if (booking.status === "requested") return deny("The sitter hasn't accepted yet");
  if (booking.status === "disputed") return deny(DISPUTE_DEAD_END);
  if (booking.status === "completed") return deny("This booking is closed");
  return allow;
}
