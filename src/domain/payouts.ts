import { earningOfVisit } from "./earnings";
import type { Earning } from "./earnings";
import type { DomainState, IsoDateTime, PayoutId, SitterId } from "./types";

/** Вывод с суммами: сами суммы считаются по визитам, а не хранятся. */
export interface PayoutRecord {
  id: PayoutId;
  paidAt: IsoDateTime;
  earnings: Earning[];
  grossMinor: number;
  feeMinor: number;
  netMinor: number;
}

/** История выводов — новые сверху: сверяются обычно с последним поступлением. */
export function payoutsOfSitter(state: DomainState, sitterId: SitterId): PayoutRecord[] {
  return Object.values(state.payouts)
    .filter((payout) => payout.sitterId === sitterId)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .map((payout) => {
      const earnings = payout.visitIds
        .map((visitId) => earningOfVisit(state, visitId))
        .filter((earning): earning is Earning => earning !== undefined);
      return {
        id: payout.id,
        paidAt: payout.paidAt,
        earnings,
        grossMinor: total(earnings, (item) => item.grossMinor),
        feeMinor: total(earnings, (item) => item.feeMinor),
        netMinor: total(earnings, (item) => item.netMinor),
      };
    });
}

export function selectionTotalMinor(state: DomainState, visitIds: string[]): number {
  return visitIds.reduce((sum, visitId) => sum + (earningOfVisit(state, visitId)?.netMinor ?? 0), 0);
}

function total(earnings: Earning[], pick: (item: Earning) => number): number {
  return earnings.reduce((sum, item) => sum + pick(item), 0);
}
