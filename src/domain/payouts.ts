import { bucketOf, earningOfVisit } from "./earnings";
import type { Bucket, Earning } from "./earnings";
import type { DomainState, IsoDateTime, PayoutId, SitterId, VisitId } from "./types";

/** Вывод с суммами: сами суммы считаются по визитам, а не хранятся. */
export interface PayoutRecord extends Bucket {
  id: PayoutId;
  paidAt: IsoDateTime;
}

/** История выводов — новые сверху: сверяются обычно с последним поступлением. */
export function payoutsOfSitter(state: DomainState, sitterId: SitterId): PayoutRecord[] {
  return Object.values(state.payouts)
    .filter((payout) => payout.sitterId === sitterId)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .map((payout) => ({
      id: payout.id,
      paidAt: payout.paidAt,
      ...selectionBucket(state, payout.visitIds),
    }));
}

/**
 * Суммы выбранного к выводу набора — все три, а не только «на руки»:
 * комиссия должна быть видна до нажатия, а не обнаружиться после.
 */
export function selectionBucket(state: DomainState, visitIds: VisitId[]): Bucket {
  return bucketOf(
    visitIds
      .map((visitId) => earningOfVisit(state, visitId))
      .filter((earning): earning is Earning => earning !== undefined),
  );
}
