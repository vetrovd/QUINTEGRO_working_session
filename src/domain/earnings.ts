import { feeMinor, netMinor } from "./money";
import type {
  Booking,
  BookingId,
  DomainState,
  IsoDate,
  IsoDateTime,
  SitterId,
  SlotOfDay,
  VisitId,
} from "./types";
import { visitsOfBooking } from "./visits";

export type EarningStatus = "locked" | "available" | "paidOut";

export interface Earning {
  visitId: VisitId;
  bookingId: BookingId;
  sitterId: SitterId;
  date: IsoDate;
  slot: SlotOfDay;
  grossMinor: number;
  feeMinor: number;
  netMinor: number;
  status: EarningStatus;
  completedAt: IsoDateTime;
}

export interface Bucket {
  count: number;
  grossMinor: number;
  feeMinor: number;
  netMinor: number;
  items: Earning[];
}

export type Balance = Record<EarningStatus, Bucket>;

/**
 * Начисления — проекция завершённых визитов, а не отдельная коллекция.
 * Поэтому «на один завершённый визит ровно один Earning» выполняется
 * структурно: считать нечего, кроме визитов со сданным отчётом.
 */
export function earningsOfBooking(state: DomainState, bookingId: BookingId): Earning[] {
  const booking = state.bookings[bookingId];
  if (!booking) return [];
  const paid = paidOutVisitIds(state);

  return visitsOfBooking(state, bookingId)
    .filter((visit) => visit.status === "completed")
    .map((visit) => {
      const gross = booking.ratePerVisitMinor;
      return {
        visitId: visit.id,
        bookingId,
        sitterId: booking.sitterId,
        date: visit.date,
        slot: visit.slot,
        grossMinor: gross,
        feeMinor: feeMinor(gross),
        netMinor: netMinor(gross),
        status: earningStatus(booking, paid.has(visit.id)),
        completedAt: visit.completedAt ?? visit.checkedInAt ?? booking.requestedAt,
      };
    });
}

/** Начисление по одному визиту — им пользуются и выводы, и их история. */
export function earningOfVisit(state: DomainState, visitId: VisitId): Earning | undefined {
  const visit = state.visits[visitId];
  if (!visit) return undefined;
  return earningsOfBooking(state, visit.bookingId).find((earning) => earning.visitId === visitId);
}

/** Визиты, деньги за которые уже выведены. */
export function paidOutVisitIds(state: DomainState): Set<VisitId> {
  return new Set(Object.values(state.payouts).flatMap((payout) => payout.visitIds));
}

export function earningsOfSitter(state: DomainState, sitterId: SitterId): Earning[] {
  return Object.values(state.bookings)
    .filter((booking) => booking.sitterId === sitterId)
    .flatMap((booking) => earningsOfBooking(state, booking.id))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export function balanceOfSitter(state: DomainState, sitterId: SitterId): Balance {
  const earnings = earningsOfSitter(state, sitterId);
  return {
    locked: bucket(earnings.filter((earning) => earning.status === "locked")),
    available: bucket(earnings.filter((earning) => earning.status === "available")),
    paidOut: bucket(earnings.filter((earning) => earning.status === "paidOut")),
  };
}

/** Сумма за фактически завершённые визиты — то, что реально начислено. */
export function earnedTotalMinor(state: DomainState, bookingId: BookingId): number {
  return earningsOfBooking(state, bookingId).reduce(
    (total, earning) => total + earning.grossMinor,
    0,
  );
}

/**
 * Стоимость набора визитов по ставке. Живёт в домене, потому что нужна и до
 * появления брони — семье, которая ещё только выбирает период.
 */
export function quoteTotalMinor(ratePerVisitMinor: number, visitCount: number): number {
  return visitCount * ratePerVisitMinor;
}

/** Сумма по плану: все визиты брони, кроме отменённых. */
export function plannedTotalMinor(state: DomainState, bookingId: BookingId): number {
  const booking = state.bookings[bookingId];
  if (!booking) return 0;
  const visits = visitsOfBooking(state, bookingId).filter((visit) => visit.status !== "cancelled");
  return quoteTotalMinor(booking.ratePerVisitMinor, visits.length);
}

/**
 * Правило разблокировки (ADR 0001): деньги становятся доступными только когда
 * семья подтвердила закрытие брони. Выведенное дальше не участвует в доступном —
 * «заработал» и «вывел» это разные вещи.
 */
function earningStatus(booking: Booking, paidOut: boolean): EarningStatus {
  if (paidOut) return "paidOut";
  return booking.status === "completed" ? "available" : "locked";
}

function bucket(items: Earning[]): Bucket {
  return {
    count: items.length,
    grossMinor: items.reduce((total, item) => total + item.grossMinor, 0),
    feeMinor: items.reduce((total, item) => total + item.feeMinor, 0),
    netMinor: items.reduce((total, item) => total + item.netMinor, 0),
    items,
  };
}
