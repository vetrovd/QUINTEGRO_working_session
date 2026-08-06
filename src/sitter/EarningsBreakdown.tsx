import { useEffect, useRef, useState } from "react";
import { earningsByBooking, lockReasonOf } from "../domain/earnings";
import type { Balance, BookingEarnings, Earning, EarningStatus } from "../domain/earnings";
import { formatMoney } from "../domain/money";
import { SEED_SITTER_ID } from "../domain/seed";
import type { BookingId, DomainState } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import {
  earningStatusText,
  formatDate,
  formatDateRange,
  plural,
  slotName,
} from "../app/format";
import { scrollIntoScreen } from "../app/PhoneFrame";
import { routeToHash } from "../app/routes";
import { EmptyState, SectionTitle } from "../app/ui";

const PART_TONES: Record<EarningStatus, string> = {
  locked: "bg-amber-100 text-amber-900",
  available: "bg-emerald-100 text-emerald-900",
  paidOut: "bg-stone-100 text-stone-600",
};

const PARTS: EarningStatus[] = ["locked", "available", "paidOut"];

/**
 * Откуда взялся баланс: строка на бронь, раскрытие — до отдельных визитов.
 * Баланс уже сложил деньги в три числа и потерял происхождение; здесь видно,
 * что заблокированное и доступное пришли из разных броней.
 */
export function EarningsBreakdown({ focusBookingId }: { focusBookingId?: BookingId }) {
  const { state } = useStore();
  const rows = earningsByBooking(state, SEED_SITTER_ID);
  // Бронь, из которой пришли по ссылке, раскрыта сразу: переход «из работы в
  // деньги» должен заканчиваться на нужной строке, а не рядом с ней.
  const [expanded, setExpanded] = useState<Set<BookingId>>(
    () => new Set(focusBookingId ? [focusBookingId] : []),
  );

  const toggle = (bookingId: BookingId) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });

  return (
    <section>
      <SectionTitle hint="Where the balance came from, booking by booking">
        Booking by booking
      </SectionTitle>

      {rows.length === 0 ? (
        <EmptyState>
          Nothing to break down yet. A booking shows up here once a visit has a filed report.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <BookingRow
              key={row.bookingId}
              row={row}
              state={state}
              focused={row.bookingId === focusBookingId}
              expanded={expanded.has(row.bookingId)}
              onToggle={() => toggle(row.bookingId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BookingRow({
  row,
  state,
  focused,
  expanded,
  onToggle,
}: {
  row: BookingEarnings;
  state: DomainState;
  focused: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const booking = state.bookings[row.bookingId];
  const pet = state.pets[booking.petId];
  const family = state.families[booking.familyId];
  const lockReason = row.parts.locked.count > 0 ? lockReasonOf(state, row.bookingId) : undefined;
  const card = useRef<HTMLDivElement>(null);

  // Рамка сбрасывает прокрутку на новом экране, и делает это после эффектов
  // потомков; кадром позже эта строка забирает прокрутку себе. Переход «из
  // работы в деньги» должен закончиться на строке, а не рядом с ней.
  useEffect(() => {
    if (!focused) return;
    const frame = requestAnimationFrame(() => {
      if (card.current) scrollIntoScreen(card.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [focused]);

  return (
    <div
      ref={card}
      className={`rounded-lg border bg-white shadow-sm ${
        focused ? "border-stone-400 ring-1 ring-stone-300" : "border-stone-200"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full p-4 text-left"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-stone-900">
            {formatDateRange(booking.startDate, booking.endDate)}
          </p>
          <p className="text-base font-semibold tabular-nums text-stone-900">
            {formatMoney(row.total.netMinor)}
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-stone-500">
            {pet.name} · {family.name}
          </p>
          <p className="text-xs text-stone-500">{plural(row.total.count, "visit")}</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PartChips parts={row.parts} />
          <span className="ml-auto text-xs text-stone-500">
            {expanded ? "Hide visits ▲" : "Show visits ▼"}
          </span>
        </div>
      </button>

      {lockReason && (
        <p className="mx-4 mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {lockReason}
        </p>
      )}

      {expanded && (
        <ul className="mx-4 mb-3 flex flex-col divide-y divide-stone-100 border-t border-stone-100">
          {row.items.map((earning) => (
            <VisitLine key={earning.visitId} earning={earning} />
          ))}
        </ul>
      )}

      {/* Из денег — обратно в работу: ссылка на бронь, чьи это начисления. */}
      <a
        href={routeToHash({ role: "sitter", screen: "booking", bookingId: row.bookingId })}
        className="block border-t border-stone-100 px-4 py-2.5 text-sm text-stone-500 transition hover:text-stone-900"
      >
        Open booking <span aria-hidden="true" className="ml-0.5">→</span>
      </a>
    </div>
  );
}

/**
 * Состояние денег брони одинаково выглядит и в разбивке, и в шапке самой
 * брони: это одна и та же величина, показанная в двух местах.
 */
export function PartChips({ parts }: { parts: Balance }) {
  return (
    <>
      {PARTS.filter((part) => parts[part].count > 0).map((part) => (
        <span
          key={part}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PART_TONES[part]}`}
        >
          {earningStatusText(part)} {formatMoney(parts[part].netMinor)}
        </span>
      ))}
    </>
  );
}

function VisitLine({ earning }: { earning: Earning }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2">
      <div>
        <p className="text-sm text-stone-700">
          {formatDate(earning.date)}, {slotName(earning.slot).toLowerCase()}
        </p>
        <p className="text-xs text-stone-500">{earningStatusText(earning.status)}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums text-stone-900">
          {formatMoney(earning.netMinor)}
        </p>
        <p className="text-xs tabular-nums text-stone-500">
          {formatMoney(earning.grossMinor)} − {formatMoney(earning.feeMinor)}
        </p>
      </div>
    </li>
  );
}
