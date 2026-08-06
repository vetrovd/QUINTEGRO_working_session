import { balanceOfSitter } from "../domain/earnings";
import type { Bucket, Earning, EarningStatus } from "../domain/earnings";
import { feeRateLabel, formatMoney } from "../domain/money";
import { SEED_SITTER_ID } from "../domain/seed";
import { useStore } from "../store/StoreProvider";
import { formatDate, plural, slotName } from "../app/format";
import { Card, EmptyState, SectionTitle } from "../app/ui";

const PARTS: { status: EarningStatus; label: string; dot: string }[] = [
  { status: "locked", label: "Locked", dot: "bg-amber-500" },
  { status: "available", label: "Available to cash out", dot: "bg-emerald-500" },
  { status: "paidOut", label: "Cashed out", dot: "bg-stone-400" },
];

/**
 * Заработок ситтера. Главная величина — на руки: именно на этот вопрос ситтер
 * ищет ответ. Сумма до комиссии и сама комиссия идут рядом, чтобы вывод не
 * оказался неожиданностью.
 */
export function EarningsPanel() {
  const { state } = useStore();
  const balance = balanceOfSitter(state, SEED_SITTER_ID);
  const hasEarnings = PARTS.some((part) => balance[part.status].count > 0);
  const disputedLocked = balance.locked.items.filter(
    (earning) => state.bookings[earning.bookingId].status === "disputed",
  ).length;

  return (
    <section>
      <SectionTitle hint={`Platform fee — ${feeRateLabel} of each visit`}>Earnings</SectionTitle>

      {!hasEarnings ? (
        <EmptyState>
          No earnings yet. One shows up for every visit with a filed report.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {PARTS.map((part) => (
              <StatTile
                key={part.status}
                label={part.label}
                dot={part.dot}
                bucket={balance[part.status]}
              />
            ))}
          </div>

          {/* Спор — другая причина блокировки: обещание «семья подтвердит» для
              него неверно, поэтому объяснения не складываются, а исключают друг
              друга. */}
          {balance.locked.count - disputedLocked > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Locked money unlocks when the family confirms the booking is closed. Until then it
              can't be cashed out.
            </p>
          )}

          {disputedLocked > 0 && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
              Locked by a dispute: {plural(disputedLocked, "visit")}. The family disputed the
              closing, and
              this money stays locked until it's reviewed.
            </p>
          )}

          {/* Выведенное расписано в истории выводов — здесь дублировать не нужно. */}
          {PARTS.filter(
            (part) => part.status !== "paidOut" && balance[part.status].count > 0,
          ).map((part) => (
            <Breakdown
              key={part.status}
              label={part.label}
              items={balance[part.status].items}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StatTile({ label, dot, bucket }: { label: string; dot: string; bucket: Bucket }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
        <p className="text-sm text-stone-600">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-semibold text-stone-900">
        {formatMoney(bucket.netMinor)}
      </p>
      <p className="mt-1 text-xs text-stone-500">
        take-home · {formatMoney(bucket.grossMinor)} before fees, {formatMoney(bucket.feeMinor)}{" "}
        fee
      </p>
      <p className="mt-2 text-xs text-stone-500">visits: {bucket.count}</p>
    </Card>
  );
}

function Breakdown({ label, items }: { label: string; items: Earning[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-stone-400 uppercase">
        {label} · visit by visit
      </p>
      <Card>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-stone-500">
              <th className="pb-1 font-medium">Visit</th>
              <th className="pb-1 text-right font-medium">Before fees</th>
              <th className="pb-1 text-right font-medium">Fee</th>
              <th className="pb-1 text-right font-medium">Take-home</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.visitId} className="border-t border-stone-100">
                <td className="py-1.5 text-stone-700">
                  {formatDate(item.date)}, {slotName(item.slot).toLowerCase()}
                </td>
                <td className="py-1.5 text-right text-stone-600">
                  {formatMoney(item.grossMinor)}
                </td>
                <td className="py-1.5 text-right text-stone-600">{formatMoney(item.feeMinor)}</td>
                <td className="py-1.5 text-right font-medium text-stone-900">
                  {formatMoney(item.netMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
