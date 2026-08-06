import { SLOT_TIMES, parseIsoDate } from "../domain/dates";
import type { EarningStatus } from "../domain/earnings";
import { LOCALE } from "../domain/money";
import type {
  BookingStatus,
  CareTask,
  DomainEvent,
  IsoDate,
  IsoDateTime,
  KeyHandoverMethod,
  Role,
  SlotOfDay,
  VisitStatus,
} from "../domain/types";

const SLOT_LABELS: Record<SlotOfDay, string> = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Awaiting response",
  confirmed: "Accepted",
  readyToStart: "Ready to start",
  inProgress: "Care in progress",
  terminatedEarly: "Ended early",
  awaitingHandback: "Awaiting closing",
  completed: "Closed",
  disputed: "Disputed",
  declined: "Declined",
  cancelled: "Canceled",
};

/**
 * Тонов ровно столько, сколько состояний различает читатель: ход за кем-то,
 * работа идёт, всё кончилось, дальше хода нет. Раньше их было шесть семейств
 * на десять статусов — цвет переставал что-либо значить и начинал спорить с
 * цветами шагов, по которым и читается, где бронь застряла.
 */
const STATUS_TONES: Record<BookingStatus, string> = {
  requested: "bg-amber-100 text-amber-900",
  confirmed: "bg-stone-100 text-stone-700",
  readyToStart: "bg-stone-100 text-stone-700",
  inProgress: "bg-emerald-100 text-emerald-900",
  // Прерванная опека — не ожидание чьего-то хода, а «состоялось, но не так,
  // как договаривались». Тем же тоном помечен несостоявшийся визит.
  terminatedEarly: "bg-orange-100 text-orange-900",
  awaitingHandback: "bg-amber-100 text-amber-900",
  completed: "bg-stone-800 text-white",
  disputed: "bg-red-600 text-white",
  declined: "bg-red-100 text-red-900",
  cancelled: "bg-stone-200 text-stone-500",
};

const METHOD_LABELS: Record<KeyHandoverMethod, string> = {
  inPerson: "In person",
  lockbox: "Lockbox",
  doorCode: "Door code",
};

const VISIT_LABELS: Record<VisitStatus, string> = {
  scheduled: "Scheduled",
  checkedIn: "Sitter on site",
  completed: "Report filed",
  missed: "Missed",
  cancelled: "Canceled",
};

/** Части баланса называются одинаково везде: иначе они читаются как разные величины. */
const EARNING_LABELS: Record<EarningStatus, string> = {
  locked: "Locked",
  available: "Available",
  paidOut: "Cashed out",
};

const CARE_TASK_LABELS: Record<CareTask, string> = {
  feeding: "Feeding",
  water: "Fresh water",
  litter: "Litter box",
  walk: "Walk",
  meds: "Medication",
};

const ROLE_LABELS: Record<Role, string> = {
  family: "the family",
  sitter: "the sitter",
};

/** Журнал прототипа: событие домена человеческим языком. */
const EVENT_LABELS: Record<DomainEvent["type"], string> = {
  BookingRequested: "Family sent a booking request",
  BookingAccepted: "Sitter accepted the booking",
  BookingDeclined: "Sitter declined the booking",
  BookingCancelled: "Booking canceled",
  MeetGreetProposed: "Meet & greet time proposed",
  MeetGreetAccepted: "Meet & greet time accepted",
  MeetGreetHappened: "Meet & greet took place",
  KeyHandoverProposed: "Key handoff proposed",
  KeyHandoverConfirmed: "Key handoff confirmed",
  VisitCheckedIn: "Sitter checked in",
  VisitReportSaved: "Report saved",
  VisitReportSubmitted: "Report filed",
  VisitReportRead: "Family read the report",
  VisitMissed: "Visit missed",
  BookingTerminatedEarly: "Care ended early",
  HandbackRequested: "Sitter submitted the work",
  HandbackConfirmed: "Family confirmed closing",
  HandbackAutoConfirmed: "Closed automatically — family stayed silent",
  HandbackDisputed: "Family disputed the closing",
  PayoutRequested: "Sitter cashed out",
};

export function eventLabel(event: DomainEvent): string {
  return EVENT_LABELS[event.type];
}

/** Остаток окна: сутки и часы, ниже суток — часы и минуты. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function slotLabel(slot: SlotOfDay): string {
  return `${SLOT_LABELS[slot]}, ${clockLabel(SLOT_TIMES[slot])}`;
}

/** «14:00» из домена → «2:00 PM»: 24 часа американский рынок не читает. */
function clockLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/**
 * Счётные существительные: «1 photos» выдаёт перевод, а не продукт. Правило
 * покрывает только то, что считается в интерфейсе, — все слова правильные.
 */
export function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

export function slotName(slot: SlotOfDay): string {
  return SLOT_LABELS[slot];
}

export function slotsLabel(slots: SlotOfDay[]): string {
  return slots.map(slotName).join(", ");
}

export function statusText(status: BookingStatus): string {
  return STATUS_LABELS[status];
}

export function statusTone(status: BookingStatus): string {
  return STATUS_TONES[status];
}

export function methodLabel(method: KeyHandoverMethod): string {
  return METHOD_LABELS[method];
}

export function visitStatusText(status: VisitStatus): string {
  return VISIT_LABELS[status];
}

export function careTaskLabel(task: CareTask): string {
  return CARE_TASK_LABELS[task];
}

export function earningStatusText(status: EarningStatus): string {
  return EARNING_LABELS[status];
}

export function awaitingLabel(roles: Role[]): string {
  return roles.map((role) => ROLE_LABELS[role]).join(" and ");
}

const dayMonth = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });
const dayMonthWeekday = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const dayMonthTime = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeOnly = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit" });

export function formatDate(date: IsoDate): string {
  return dayMonth.format(parseIsoDate(date));
}

export function formatDateWithWeekday(date: IsoDate): string {
  return dayMonthWeekday.format(parseIsoDate(date));
}

export function formatDateRange(start: IsoDate, end: IsoDate): string {
  return `${formatDate(start)} — ${formatDate(end)}`;
}

export function formatDateTime(at: IsoDateTime): string {
  return dayMonthTime.format(new Date(at));
}

export function formatTime(at: IsoDateTime): string {
  return timeOnly.format(new Date(at));
}

/** Значение для `<input type="datetime-local">`. */
export function toDateTimeInput(at: IsoDateTime): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeInput(value: string): IsoDateTime {
  return new Date(value).toISOString();
}
