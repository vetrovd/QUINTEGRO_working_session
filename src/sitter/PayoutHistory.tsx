import { formatMoney } from "../domain/money";
import { payoutsOfSitter } from "../domain/payouts";
import { SEED_SITTER_ID } from "../domain/seed";
import { useStore } from "../store/StoreProvider";
import { formatDate, formatDateTime, plural, slotName } from "../app/format";
import { Card, SectionTitle } from "../app/ui";

/**
 * История выводов — последний раздел: «сколько у меня есть» и «откуда это
 * взялось» отвечают на вопросы сегодняшнего дня, а история нужна для сверки.
 * Вывод и заработок остаются разными событиями и разными строками.
 */
export function PayoutHistory() {
  const { state } = useStore();
  const history = payoutsOfSitter(state, SEED_SITTER_ID);

  if (history.length === 0) return null;

  return (
    <section>
      <SectionTitle hint="What already left the platform">Payout history</SectionTitle>
      <div className="flex flex-col gap-3">
        {history.map((record) => (
          <Card key={record.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-title tabular-nums text-stone-900">{formatMoney(record.netMinor)}</p>
              <p className="text-meta text-stone-500">{formatDateTime(record.paidAt)}</p>
            </div>
            <p className="mt-1 text-meta tabular-nums text-stone-500">
              {formatMoney(record.grossMinor)} before fees, {formatMoney(record.feeMinor)} fee
            </p>
            <p className="mt-2 text-meta text-stone-600">
              {plural(record.count, "visit")}:{" "}
              {record.items
                .map(
                  (earning) => `${formatDate(earning.date)}, ${slotName(earning.slot).toLowerCase()}`,
                )
                .join(" · ")}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
