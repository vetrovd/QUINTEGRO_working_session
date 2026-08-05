import { SLOT_TIMES, parseIsoDate } from "../domain/dates";
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
  morning: "Утро",
  midday: "День",
  evening: "Вечер",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Ожидает ответа",
  confirmed: "Принята",
  readyToStart: "Готова к старту",
  inProgress: "Опека идёт",
  awaitingHandback: "Ждёт подтверждения закрытия",
  completed: "Опека закрыта",
  disputed: "Спор",
  declined: "Отклонена",
  cancelled: "Отменена",
};

const STATUS_TONES: Record<BookingStatus, string> = {
  requested: "bg-amber-100 text-amber-900",
  confirmed: "bg-sky-100 text-sky-900",
  readyToStart: "bg-indigo-100 text-indigo-900",
  inProgress: "bg-emerald-100 text-emerald-900",
  awaitingHandback: "bg-amber-200 text-amber-900",
  completed: "bg-stone-800 text-white",
  disputed: "bg-red-600 text-white",
  declined: "bg-red-100 text-red-900",
  cancelled: "bg-stone-200 text-stone-600",
};

const METHOD_LABELS: Record<KeyHandoverMethod, string> = {
  inPerson: "Личная встреча",
  lockbox: "Лок-бокс",
  doorCode: "Код домофона",
};

const VISIT_LABELS: Record<VisitStatus, string> = {
  scheduled: "Запланирован",
  checkedIn: "Ситтер на месте",
  completed: "Отчёт сдан",
  cancelled: "Отменён",
};

const CARE_TASK_LABELS: Record<CareTask, string> = {
  feeding: "Кормление",
  water: "Свежая вода",
  litter: "Лоток",
  walk: "Прогулка",
  meds: "Медикаменты",
};

const ROLE_LABELS: Record<Role, string> = {
  family: "семьи",
  sitter: "ситтера",
};

/** Журнал прототипа: событие домена по-русски. */
const EVENT_LABELS: Record<DomainEvent["type"], string> = {
  BookingRequested: "Семья отправила запрос на бронь",
  BookingAccepted: "Ситтер принял бронь",
  BookingDeclined: "Ситтер отклонил бронь",
  BookingCancelled: "Бронь отменена",
  MeetGreetProposed: "Предложено время знакомства",
  MeetGreetAccepted: "Время знакомства принято",
  MeetGreetHappened: "Знакомство состоялось",
  KeyHandoverProposed: "Предложена передача ключей",
  KeyHandoverConfirmed: "Передача ключей подтверждена",
  VisitCheckedIn: "Ситтер отметил приход",
  VisitReportSaved: "Отчёт сохранён",
  VisitReportSubmitted: "Отчёт сдан",
  VisitReportRead: "Семья прочитала отчёт",
  HandbackRequested: "Ситтер заявил сдачу работы",
  HandbackConfirmed: "Семья подтвердила закрытие",
  HandbackAutoConfirmed: "Закрытие по молчанию семьи",
  HandbackDisputed: "Семья оспорила закрытие",
  PayoutRequested: "Ситтер вывел деньги",
};

export function eventLabel(event: DomainEvent): string {
  return EVENT_LABELS[event.type];
}

/** Остаток окна: сутки и часы, ниже суток — часы и минуты. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes % 60} мин`;
  return `${minutes} мин`;
}

export function slotLabel(slot: SlotOfDay): string {
  return `${SLOT_LABELS[slot]}, ${SLOT_TIMES[slot]}`;
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

export function awaitingLabel(roles: Role[]): string {
  return roles.map((role) => ROLE_LABELS[role]).join(" и ");
}

const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const dayMonthWeekday = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  weekday: "short",
});
const dayMonthTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
const timeOnly = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

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
