import type { BookingStatus, IsoDate, SlotOfDay } from "../domain/types";

const SLOT_LABELS: Record<SlotOfDay, string> = {
  morning: "Утро",
  midday: "День",
  evening: "Вечер",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Ожидает ответа",
  confirmed: "Принята",
  declined: "Отклонена",
  cancelled: "Отменена",
};

const STATUS_TONES: Record<BookingStatus, string> = {
  requested: "bg-amber-100 text-amber-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  declined: "bg-red-100 text-red-900",
  cancelled: "bg-stone-200 text-stone-600",
};

export function slotLabel(slot: SlotOfDay): string {
  return SLOT_LABELS[slot];
}

export function slotsLabel(slots: SlotOfDay[]): string {
  return slots.map(slotLabel).join(", ");
}

export function statusText(status: BookingStatus): string {
  return STATUS_LABELS[status];
}

export function statusTone(status: BookingStatus): string {
  return STATUS_TONES[status];
}

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export function formatDateRange(start: IsoDate, end: IsoDate): string {
  return `${dateFormatter.format(new Date(start))} — ${dateFormatter.format(new Date(end))}`;
}

export function countDays(start: IsoDate, end: IsoDate): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000))) + 1;
}
