import { earningsOfBooking } from "./earnings";
import type { BookingId, DomainState } from "./types";
import { visitsOfBooking } from "./visits";

/**
 * Сводка, по которой семья решает, подтверждать ли закрытие: сколько визитов
 * состоялось, сколько нет, и какая сумма из этого выходит.
 */
export interface HandbackSummary {
  /** Все визиты периода, кроме отменённых. */
  planned: number;
  completed: number;
  /** Визиты, которые не состоялись. Отдельный статус им даёт тикет 12. */
  notCompleted: number;
  grossMinor: number;
  feeMinor: number;
  netMinor: number;
}

export function handbackSummary(state: DomainState, bookingId: BookingId): HandbackSummary {
  const visits = visitsOfBooking(state, bookingId).filter((visit) => visit.status !== "cancelled");
  const earnings = earningsOfBooking(state, bookingId);
  const sum = (pick: (item: (typeof earnings)[number]) => number) =>
    earnings.reduce((total, item) => total + pick(item), 0);

  return {
    planned: visits.length,
    completed: earnings.length,
    notCompleted: visits.length - earnings.length,
    grossMinor: sum((item) => item.grossMinor),
    feeMinor: sum((item) => item.feeMinor),
    netMinor: sum((item) => item.netMinor),
  };
}
