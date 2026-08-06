import { useMemo, useState } from "react";
import { busyDates } from "../domain/availability";
import { addDays, countDays, parseIsoDate, toIsoDate, today } from "../domain/dates";
import { quoteTotalMinor } from "../domain/earnings";
import { canRequestBooking } from "../domain/guards";
import { LOCALE, formatMoney } from "../domain/money";
import { SEED_FAMILY_ID, SEED_PET_ID, SEED_SITTER_ID } from "../domain/seed";
import { SLOTS_OF_DAY } from "../domain/types";
import type { IsoDate, SlotOfDay } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateRange, plural, slotLabel } from "../app/format";
import { Card, GuardedButton } from "../app/ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Календарь бронирования. Показывает занятые дни, диапазон выбирается двумя
 * кликами, а до отправки запроса видно, во сколько визитов и в какую сумму
 * разворачивается период.
 */
export function BookingCalendar() {
  const { state, dispatch, now } = useStore();
  const sitter = state.sitters[SEED_SITTER_ID];
  const pet = state.pets[SEED_PET_ID];
  const currentDate = today(now);

  const [month, setMonth] = useState(() => startOfMonth(currentDate));
  const [start, setStart] = useState<IsoDate | null>(currentDate);
  const [end, setEnd] = useState<IsoDate | null>(addDays(currentDate, 4));
  const [slots, setSlots] = useState<SlotOfDay[]>(["morning", "evening"]);

  const busy = useMemo(() => busyDates(state), [state]);

  const days = start && end ? countDays(start, end) : 0;
  const visits = days * slots.length;
  const totalMinor = quoteTotalMinor(sitter.ratePerVisitMinor, visits);
  // Отправку разрешает домен, а не форма: причина отказа приходит из guard'а
  // тем же путём, что и у любого другого действия в прототипе.
  const guard = canRequestBooking(state, { startDate: start, endDate: end, slots });

  function pickDate(date: IsoDate) {
    if (!start || (start && end)) {
      setStart(date);
      setEnd(null);
      return;
    }
    if (date < start) {
      setStart(date);
      return;
    }
    setEnd(date);
  }

  function toggleSlot(slot: SlotOfDay) {
    setSlots((current) =>
      current.includes(slot)
        ? current.filter((item) => item !== slot)
        : SLOTS_OF_DAY.filter((item) => current.includes(item) || item === slot),
    );
  }

  function submit() {
    if (!start || !end) return;
    dispatch({
      type: "BookingRequested",
      bookingId: crypto.randomUUID(),
      familyId: SEED_FAMILY_ID,
      sitterId: SEED_SITTER_ID,
      petId: SEED_PET_ID,
      startDate: start,
      endDate: end,
      slots,
    });
    setStart(null);
    setEnd(null);
  }

  return (
    <section>
      <p className="mb-3 text-sm text-stone-500">
        {sitter.name} charges {formatMoney(sitter.ratePerVisitMinor)} a visit · pet: {pet.name}
      </p>
      <Card>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className={navClass}>
            ←
          </button>
          <p className="text-sm font-medium text-stone-900">{monthTitle(month)}</p>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className={navClass}>
            →
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-stone-400">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {monthGrid(month).map((date, index) =>
            date === null ? (
              <span key={`empty-${index}`} />
            ) : (
              <DayCell
                key={date}
                date={date}
                busy={busy.has(date)}
                selected={isSelected(date, start, end)}
                edge={date === start || date === end}
                past={date < currentDate}
                onPick={() => pickDate(date)}
              />
            ),
          )}
        </div>

        <fieldset className="mt-4 border-t border-stone-200 pt-4">
          <legend className="text-sm font-medium text-stone-700">Visits a day</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {SLOTS_OF_DAY.map((slot) => (
              <label key={slot} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={slots.includes(slot)}
                  onChange={() => toggleSlot(slot)}
                  className="size-4 accent-stone-900"
                />
                {slotLabel(slot)}
              </label>
            ))}
          </div>
        </fieldset>

      </Card>

      {/* Итог закреплён внизу: он пересчитывается на глазах по мере выбора,
          а не открывается в конце отдельным шагом. */}
      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
        {guard.allowed && start && end && (
          <p className="text-sm text-stone-600">
            {formatDateRange(start, end)} · {plural(visits, "visit")} ×{" "}
            {formatMoney(sitter.ratePerVisitMinor)} ·{" "}
            <strong className="text-stone-900">{formatMoney(totalMinor)}</strong>
          </p>
        )}
        <div className="mt-2 [&>span]:w-full [&_button]:w-full">
          <GuardedButton guard={guard} onClick={submit}>
            Send request
          </GuardedButton>
        </div>
      </div>
    </section>
  );
}

const navClass =
  "rounded-md border border-stone-300 px-2 py-1 text-sm text-stone-600 transition hover:bg-stone-50";

function DayCell({
  date,
  busy,
  selected,
  edge,
  past,
  onPick,
}: {
  date: IsoDate;
  busy: boolean;
  selected: boolean;
  edge: boolean;
  past: boolean;
  onPick: () => void;
}) {
  const tone = edge
    ? "bg-stone-900 text-white"
    : selected
      ? "bg-stone-200 text-stone-900"
      : busy
        ? "bg-amber-100 text-amber-900"
        : "hover:bg-stone-100";

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy || past}
      title={busy ? "Taken by another booking" : past ? "This day has passed" : undefined}
      className={`rounded-md py-1.5 text-sm transition disabled:cursor-not-allowed ${tone} ${past && !busy ? "text-stone-300" : ""}`}
    >
      {parseIsoDate(date).getDate()}
    </button>
  );
}

function isSelected(date: IsoDate, start: IsoDate | null, end: IsoDate | null): boolean {
  if (!start) return false;
  if (!end) return date === start;
  return date >= start && date <= end;
}

function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(month: IsoDate, delta: number): IsoDate {
  const date = parseIsoDate(month);
  date.setMonth(date.getMonth() + delta);
  return toIsoDate(date);
}

function monthTitle(month: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" }).format(
    parseIsoDate(month),
  );
}

/** Сетка месяца с воскресенья — неделя на рынке США начинается с него. */
function monthGrid(month: IsoDate): (IsoDate | null)[] {
  const first = parseIsoDate(month);
  const lead = first.getDay();
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (IsoDate | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toIsoDate(new Date(first.getFullYear(), first.getMonth(), day)));
  }
  return cells;
}
