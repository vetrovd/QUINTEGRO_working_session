import { balanceOfSitter, earningsByBooking, lockReasonOf } from "../domain/earnings";
import type { Bucket, EarningStatus } from "../domain/earnings";
import { feeRateLabel, formatMoney } from "../domain/money";
import { SEED_SITTER_ID } from "../domain/seed";
import type { DomainState } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { earningStatusText, formatDateRange, plural } from "../app/format";
import { Card, EmptyState, SectionTitle } from "../app/ui";

const PARTS: { status: EarningStatus; dot: string }[] = [
  { status: "locked", dot: "bg-amber-500" },
  { status: "available", dot: "bg-emerald-500" },
  { status: "paidOut", dot: "bg-stone-400" },
];

/**
 * Три части баланса — первое, что видно в разделе: сначала «сколько у меня
 * есть», и только потом «откуда это взялось». Главная величина в каждой части —
 * на руки: комиссия уже удержана, и ситтеру нужно число, которое дойдёт.
 */
export function BalancePanel() {
  const { state } = useStore();
  const balance = balanceOfSitter(state, SEED_SITTER_ID);
  const hasEarnings = PARTS.some((part) => balance[part.status].count > 0);

  if (!hasEarnings) {
    return (
      <section>
        <SectionTitle hint={`Platform fee — ${feeRateLabel} of each visit`}>Balance</SectionTitle>
        <EmptyState>No earnings yet. One shows up for every visit with a filed report.</EmptyState>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle hint={`Platform fee — ${feeRateLabel} of each visit`}>Balance</SectionTitle>
      <Card>
        <ul className="flex flex-col divide-y divide-stone-100">
          {PARTS.map((part) => (
            <li key={part.status} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-stone-600">
                  <span className={`size-2 rounded-full ${part.dot}`} aria-hidden="true" />
                  {earningStatusText(part.status)}
                </span>
                <span className="text-xl font-semibold tabular-nums text-stone-900">
                  {formatMoney(balance[part.status].netMinor)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                <Amounts bucket={balance[part.status]} />
              </p>
              {part.status === "locked" && balance.locked.count > 0 && (
                <LockNotes state={state} />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/** Три величины всегда рядом: на руки видно крупно, откуда оно — под ним. */
function Amounts({ bucket }: { bucket: Bucket }) {
  return (
    <>
      {plural(bucket.count, "visit")} · {formatMoney(bucket.grossMinor)} before fees,{" "}
      {formatMoney(bucket.feeMinor)} fee
    </>
  );
}

/**
 * Что держит заблокированное — в терминах конкретной брони: одно правило
 * (ADR 0001) на весь баланс не говорит ситтеру, куда идти и что сделать.
 */
function LockNotes({ state }: { state: DomainState }) {
  const held = earningsByBooking(state, SEED_SITTER_ID).filter((row) => row.parts.locked.count > 0);

  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {held.map((row) => {
        const booking = state.bookings[row.bookingId];
        return (
          <li key={row.bookingId} className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-medium">
              {formatDateRange(booking.startDate, booking.endDate)} ·{" "}
              {formatMoney(row.parts.locked.netMinor)}
            </span>{" "}
            — {lockReasonOf(state, row.bookingId)}
          </li>
        );
      })}
    </ul>
  );
}
