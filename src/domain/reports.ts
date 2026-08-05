import type { BookingId, DomainState, Visit, VisitReport } from "./types";
import { visitsOfBooking } from "./visits";

export interface ReportedVisit {
  visit: Visit;
  report: VisitReport;
}

/** Лента отчётов по броне — хронологически, как их сдавал ситтер. */
export function submittedReportsOfBooking(
  state: DomainState,
  bookingId: BookingId,
): ReportedVisit[] {
  return visitsOfBooking(state, bookingId)
    .map((visit) => ({ visit, report: state.reports[visit.id] }))
    .filter((item): item is ReportedVisit => item.report?.status === "submitted");
}

export function unreadReportsCount(state: DomainState, bookingId: BookingId): number {
  return submittedReportsOfBooking(state, bookingId).filter(
    (item) => !item.report.readByFamilyAt,
  ).length;
}

/** Визиты, на которых ситтер был, но отчёт ещё не сдал. */
export function visitsAwaitingReport(state: DomainState, bookingId: BookingId): Visit[] {
  return visitsOfBooking(state, bookingId).filter((visit) => visit.status === "checkedIn");
}

export function isReportEmpty(report: VisitReport): boolean {
  return report.tasks.length === 0 && report.note.trim() === "" && report.photos.length === 0;
}
