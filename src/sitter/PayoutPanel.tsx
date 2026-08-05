import { useState } from "react";
import { balanceOfSitter } from "../domain/earnings";
import { canRequestPayout } from "../domain/guards";
import { formatMoney } from "../domain/money";
import { payoutsOfSitter, selectionTotalMinor } from "../domain/payouts";
import { SEED_SITTER_ID } from "../domain/seed";
import type { VisitId } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDate, formatDateTime, slotName } from "../app/format";
import { Card, EmptyState, GuardedButton, SectionTitle } from "../app/ui";

/**
 * Вывод денег. Выводится набор визитов, а не произвольная сумма: начисление
 * либо выведено целиком, либо нет — так «вывел» всегда сходится с «заработал».
 * По умолчанию выбрано всё доступное, снять галочку можно с любого визита.
 */
export function PayoutPanel() {
  const { state, dispatch } = useStore();
  const [deselected, setDeselected] = useState<Set<VisitId>>(new Set());

  const available = balanceOfSitter(state, SEED_SITTER_ID).available.items;
  const selected = available
    .filter((earning) => !deselected.has(earning.visitId))
    .map((earning) => earning.visitId);
  const history = payoutsOfSitter(state, SEED_SITTER_ID);

  const toggle = (visitId: VisitId) => {
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(visitId)) next.delete(visitId);
      else next.add(visitId);
      return next;
    });
  };

  const guard = canRequestPayout(state, SEED_SITTER_ID, selected);
  const totalMinor = selectionTotalMinor(state, selected);

  return (
    <section>
      <SectionTitle hint="В прототипе вывод мгновенный: запрошен — значит выплачен">
        Вывод средств
      </SectionTitle>

      {available.length === 0 ? (
        <EmptyState>
          Выводить пока нечего. Деньги становятся доступными, когда семья подтверждает закрытие
          брони.
        </EmptyState>
      ) : (
        <Card>
          <p className="mb-2 text-sm text-stone-600">
            Доступно к выводу — {available.length} визит{available.length === 1 ? "" : "а"}. Снимите
            галочку, чтобы вывести часть.
          </p>
          <ul className="flex flex-col divide-y divide-stone-100">
            {available.map((earning) => (
              <li key={earning.visitId}>
                <label className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!deselected.has(earning.visitId)}
                    onChange={() => toggle(earning.visitId)}
                    className="size-4"
                  />
                  <span className="flex-1 text-stone-700">
                    {formatDate(earning.date)}, {slotName(earning.slot).toLowerCase()}
                  </span>
                  <span className="tabular-nums text-stone-500">
                    {formatMoney(earning.grossMinor)} − {formatMoney(earning.feeMinor)}
                  </span>
                  <span className="w-20 text-right font-medium tabular-nums text-stone-900">
                    {formatMoney(earning.netMinor)}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
            <p className="text-sm text-stone-600">
              Выбрано {selected.length} из {available.length} ·{" "}
              <span className="font-semibold text-stone-900">{formatMoney(totalMinor)}</span> на руки
            </p>
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
              Вывести {formatMoney(totalMinor)}
            </GuardedButton>
          </div>
        </Card>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-stone-400 uppercase">
            История выводов · {history.length}
          </p>
          <div className="flex flex-col gap-3">
            {history.map((record) => (
              <Card key={record.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-stone-900">
                    {formatMoney(record.netMinor)} · {formatDateTime(record.paidAt)}
                  </p>
                  <p className="text-xs text-stone-500 tabular-nums">
                    {formatMoney(record.grossMinor)} до комиссии, комиссия{" "}
                    {formatMoney(record.feeMinor)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-stone-600">
                  Визиты:{" "}
                  {record.earnings
                    .map(
                      (earning) =>
                        `${formatDate(earning.date)}, ${slotName(earning.slot).toLowerCase()}`,
                    )
                    .join(" · ")}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
