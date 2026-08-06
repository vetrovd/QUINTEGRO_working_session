import { useMemo, useState } from "react";
import { addDays, countDays, eachDate, parseIsoDate, toIsoDate, today } from "../domain/dates";
import { dollarsToMinor, formatMoney } from "../domain/money";
import { SEED_FAMILY_ID, SEED_PET_ID, SEED_SITTER_ID } from "../domain/seed";
import { SLOTS_OF_DAY } from "../domain/types";
import type { IsoDate, SlotOfDay } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateRange, slotLabel } from "../app/format";
import { Card, Field, SectionTitle, inputClass } from "../app/ui";

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
  const [rateDollars, setRateDollars] = useState(20);

  const busyDates = useMemo(() => busyDatesOf(state), [state]);

  const days = start && end ? countDays(start, end) : 0;
  const visits = days * slots.length;
  const totalMinor = visits * dollarsToMinor(rateDollars);
  const overlaps =
    start && end ? eachDate(start, end).some((date) => busyDates.has(date)) : false;
  const canSubmit = Boolean(start && end && slots.length > 0 && rateDollars > 0 && !overlaps);

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
      ratePerVisitMinor: dollarsToMinor(rateDollars),
    });
    setStart(null);
    setEnd(null);
  }

  return (
    <section>
      <SectionTitle hint={`Sitter: ${sitter.name} · pet: ${pet.name}`}>
        Booking calendar
      </SectionTitle>
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
                busy={busyDates.has(date)}
                selected={isSelected(date, start, end)}
                edge={date === start || date === end}
                past={date < currentDate}
                onPick={() => pickDate(date)}
              />
            ),
          )}
        </div>

        <div className="mt-4 grid gap-4 border-t border-stone-200 pt-4 sm:grid-cols-2">
          <fieldset>
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
          <Field label="Rate per visit, $">
            <input
              type="number"
              min={0}
              step={1}
              value={rateDollars}
              onChange={(event) => setRateDollars(Number(event.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <p className="text-sm text-stone-600">{summary()}</p>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
          >
            Send request
          </button>
        </div>
      </Card>
    </section>
  );

  function summary() {
    if (!start) return "Pick the first day of the stay";
    if (!end) return `Starting ${formatDateRange(start, start)} — pick the last day`;
    if (overlaps) return "Some days in this range are already booked";
    if (slots.length === 0) return "Pick at least one visit a day";
    return (
      <>
        {formatDateRange(start, end)} · {days} days · {visits} visits ·{" "}
        <strong>{formatMoney(totalMinor)}</strong>
      </>
    );
  }
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

/** Занятыми считаются дни живых броней — отклонённые и отменённые не мешают. */
function busyDatesOf(state: ReturnType<typeof useStore>["state"]): Set<IsoDate> {
  const busy = new Set<IsoDate>();
  for (const booking of Object.values(state.bookings)) {
    if (booking.status === "declined" || booking.status === "cancelled") continue;
    for (const date of eachDate(booking.startDate, booking.endDate)) busy.add(date);
  }
  return busy;
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
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
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
