import type { BookingId } from "../domain/types";
import { ScreenTitle } from "../app/ui";
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
