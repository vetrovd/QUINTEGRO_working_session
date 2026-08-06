import { countDays } from "./dates";
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

/** Заработок одной брони: сколько она принесла и в каком состоянии деньги. */
export interface BookingEarnings {
  bookingId: BookingId;
  items: Earning[];
  total: Bucket;
  parts: Balance;
}

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
  return splitByStatus(earningsOfSitter(state, sitterId));
}

/**
 * Разбивка заработка по броням — новые сверху, как и в списке броней. Это
 * единственное место, где видно, что заблокированное и доступное складываются
 * из разных броней: баланс их уже сложил и потерял происхождение.
 */
export function earningsByBooking(state: DomainState, sitterId: SitterId): BookingEarnings[] {
  return Object.values(state.bookings)
    .filter((booking) => booking.sitterId === sitterId)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((booking) => ({ bookingId: booking.id, items: earningsOfBooking(state, booking.id) }))
    .filter((row) => row.items.length > 0)
    .map((row) => ({
      ...row,
      total: bucketOf(row.items),
      parts: splitByStatus(row.items),
    }));
}

/** Заработка нет вовсе: ни заблокированного, ни доступного, ни выведенного. */
export function isEmptyBalance(balance: Balance): boolean {
  return balance.locked.count + balance.available.count + balance.paidOut.count === 0;
}

/**
 * Что удерживает деньги этой брони. Правило разблокировки одно (ADR 0001), но
 * ситтеру нужно знать не правило, а свой следующий шаг, — поэтому причина
 * формулируется в терминах состояния конкретной брони.
 */
export function lockReasonOf(state: DomainState, bookingId: BookingId): string | undefined {
  const booking = state.bookings[bookingId];
  if (!booking) return undefined;

  switch (booking.status) {
    case "completed":
      return undefined;
    case "disputed":
      return "The family disputed the closing — this stays locked until it's reviewed";
    case "awaitingHandback":
      return "Waiting on the family to confirm the closing";
    default:
      return "Unlocks once you submit the work and the family confirms the closing";
  }
}

function splitByStatus(earnings: Earning[]): Balance {
  return {
    locked: bucketOf(earnings.filter((earning) => earning.status === "locked")),
    available: bucketOf(earnings.filter((earning) => earning.status === "available")),
    paidOut: bucketOf(earnings.filter((earning) => earning.status === "paidOut")),
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

/**
 * Во сколько обходится бронь целиком. До ответа ситтера визитов ещё нет, и
 * считать приходится по её собственным параметрам: иначе входящий запрос
 * выглядит бесплатным ровно там, где ситтер решает, брать ли его.
 */
export function bookingTotalMinor(state: DomainState, bookingId: BookingId): number {
  const booking = state.bookings[bookingId];
  if (!booking) return 0;
  if (booking.status !== "requested") return plannedTotalMinor(state, bookingId);
  const visitsPlanned = countDays(booking.startDate, booking.endDate) * booking.slots.length;
  return quoteTotalMinor(booking.ratePerVisitMinor, visitsPlanned);
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

/** Суммы набора начислений — те же три величины, что и у любой части баланса. */
export function bucketOf(items: Earning[]): Bucket {
  return {
    count: items.length,
    grossMinor: items.reduce((total, item) => total + item.grossMinor, 0),
    feeMinor: items.reduce((total, item) => total + item.feeMinor, 0),
    netMinor: items.reduce((total, item) => total + item.netMinor, 0),
    items,
  };
}
