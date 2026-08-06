import { useState } from "react";
import type { ReactNode } from "react";
import { balanceOfSitter } from "../domain/earnings";
import { canRequestPayout } from "../domain/guards";
import { formatMoney } from "../domain/money";
import { selectionBucket } from "../domain/payouts";
import { SEED_SITTER_ID } from "../domain/seed";
import type { VisitId } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDate, plural, slotName } from "../app/format";
import { Card, EmptyState, GuardedButton, SectionTitle } from "../app/ui";

/**
 * Вывод денег. Выводится набор визитов, а не произвольная сумма: начисление
 * либо выведено целиком, либо нет — так «вывел» всегда сходится с «заработал».
 * По умолчанию выбрано всё доступное, снять галочку можно с любого визита.
 *
 * Действие стоит рядом с балансом: главное действие раздела не должно
 * находиться прокруткой.
 */
export function CashOutPanel() {
  const { state, dispatch } = useStore();
  const [deselected, setDeselected] = useState<Set<VisitId>>(new Set());

  const available = balanceOfSitter(state, SEED_SITTER_ID).available.items;
  const selected = available
    .filter((earning) => !deselected.has(earning.visitId))
    .map((earning) => earning.visitId);

  const toggle = (visitId: VisitId) => {
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(visitId)) next.delete(visitId);
      else next.add(visitId);
      return next;
    });
  };

  const guard = canRequestPayout(state, SEED_SITTER_ID, selected);
  const total = selectionBucket(state, selected);

  if (available.length === 0) {
    return (
      <section>
        <SectionTitle>Cash out</SectionTitle>
        <EmptyState>
          Nothing to cash out yet. Money becomes available when the family confirms a booking is
          closed.
        </EmptyState>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle hint="Payouts are instant in the prototype: requested means paid">
        Cash out
      </SectionTitle>

      <Card>
        <p className="mb-2 text-sm text-stone-600">
          {plural(available.length, "visit")} available. Uncheck any to cash out only part.
        </p>
        <ul className="flex flex-col divide-y divide-stone-100">
          {available.map((earning) => (
            <li key={earning.visitId}>
              <label className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={!deselected.has(earning.visitId)}
                  onChange={() => toggle(earning.visitId)}
                  className="size-4 accent-stone-900"
                />
                <span className="flex-1 text-stone-700">
                  {formatDate(earning.date)}, {slotName(earning.slot).toLowerCase()}
                </span>
                <span className="text-right font-medium tabular-nums text-stone-900">
                  {formatMoney(earning.netMinor)}
                </span>
              </label>
            </li>
          ))}
        </ul>

        {/* Три величины до нажатия, а не после: комиссия не должна быть
            новостью в момент, когда деньги уже ушли. */}
        <dl className="mt-3 flex flex-col gap-1 border-t border-stone-200 pt-3 text-sm">
          <Line label={`Before fees · ${selected.length} of ${available.length} selected`}>
            {formatMoney(total.grossMinor)}
          </Line>
          <Line label="Platform fee">−{formatMoney(total.feeMinor)}</Line>
          <Line label="Take-home" strong>
            {formatMoney(total.netMinor)}
          </Line>
        </dl>

        <div className="mt-3">
          <GuardedButton
            guard={guard}
            onClick={() => {
              dispatch({
                type: "PayoutRequested",
                payoutId: crypto.randomUUID(),
                sitterId: SEED_SITTER_ID,
                visitIds: selected,
              });
              // Остаток после вывода снова выбран целиком: снятая галочка
              // относилась к прошлому выводу, а не к тому, что осталось.
              setDeselected(new Set());
            }}
          >
            Cash out {formatMoney(total.netMinor)}
          </GuardedButton>
        </div>
      </Card>
    </section>
  );
}

function Line({
  label,
  children,
  strong = false,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? "font-medium text-stone-900" : "text-stone-500"}>{label}</dt>
      <dd
        className={`tabular-nums ${strong ? "font-semibold text-stone-900" : "text-stone-600"}`}
      >
        {children}
      </dd>
    </div>
  );
}
