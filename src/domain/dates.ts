import type { IsoDate, IsoDateTime, SlotOfDay } from "./types";

/**
 * Даты — локальные, как в `<input type="date">`. Через UTC их гонять нельзя:
 * при отрицательном смещении визит переезжал бы на предыдущий день.
 */
export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(date: IsoDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function today(now: IsoDateTime): IsoDate {
  return toIsoDate(new Date(now));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const shifted = parseIsoDate(date);
  shifted.setDate(shifted.getDate() + days);
  return toIsoDate(shifted);
}

export function eachDate(start: IsoDate, end: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function countDays(start: IsoDate, end: IsoDate): number {
  return start <= end ? eachDate(start, end).length : 0;
}

/** Ориентировочное время слота — для расписания ситтера. */
export const SLOT_TIMES: Record<SlotOfDay, string> = {
  morning: "09:00",
  midday: "14:00",
  evening: "19:00",
};
