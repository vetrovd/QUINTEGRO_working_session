import { balanceOfSitter, isEmptyBalance } from "../domain/earnings";
import { SEED_SITTER_ID } from "../domain/seed";
import type { BookingId } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { EmptyState, ScreenTitle } from "../app/ui";
import { BalancePanel } from "./BalancePanel";
import { CashOutPanel } from "./CashOutPanel";
import { EarningsBreakdown } from "./EarningsBreakdown";
import { PayoutHistory } from "./PayoutHistory";

/**
 * Порядок разделов отвечает на вопросы в том порядке, в котором их задают:
 * сколько у меня есть и можно ли это забрать, откуда оно взялось, что уже
 * ушло. Раздел держит и Earning'и, и Payout'ы — так о деньгах говорит ситтер, —
 * но «заработал» и «вывел» остаются разными строками.
 */
export function EarningsScreen({ focusBookingId }: { focusBookingId?: BookingId }) {
  const { state } = useStore();
  const nothingEarnedYet = isEmptyBalance(balanceOfSitter(state, SEED_SITTER_ID));

  // Пока не заработано ничего, у всех четырёх разделов один и тот же ответ.
  // Четыре пустых блока подряд говорят это четыре раза и не подсказывают, с
  // чего начать; одна фраза говорит один раз и отправляет в расписание.
  if (nothingEarnedYet) {
    return (
      <>
        <ScreenTitle hint="What you have, then where it came from">Earnings</ScreenTitle>
        <EmptyState>
          No money yet. File a report on a visit in Schedule and the earning shows up here — locked
          until the family confirms the booking is closed.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <ScreenTitle hint="What you have, then where it came from">Earnings</ScreenTitle>
      <div className="flex flex-col gap-8">
        <BalancePanel />
        <CashOutPanel />
        {/* Ключ перемонтирует разбивку при переходе с другой брони: раскрытие
            должно совпасть с той строкой, ради которой сюда пришли. */}
        <EarningsBreakdown key={focusBookingId ?? "all"} focusBookingId={focusBookingId} />
        <PayoutHistory />
      </div>
    </>
  );
}
