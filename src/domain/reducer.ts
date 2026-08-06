import {
  canAcceptMeetGreet,
  canAutoConfirmHandback,
  canCancelBooking,
  canCheckIn,
  canConfirmHandback,
  canConfirmKeyHandover,
  canDisputeHandback,
  canMarkMeetGreetHappened,
  canMarkReportRead,
  canMarkVisitMissed,
  canProposeKeyHandover,
  canProposeMeetGreet,
  canRequestHandback,
  canRequestPayout,
  canRespondToBooking,
  canSaveVisitReport,
  canSubmitVisitReport,
  canTerminateEarly,
  meetGreetSettled,
} from "./guards";
import type {
  Booking,
  DomainEvent,
  DomainState,
  IsoDateTime,
  JournalEntry,
  KeyHandover,
  MeetGreet,
  Payout,
  Visit,
  VisitReport,
} from "./types";
import { expandVisits } from "./visits";

export interface ReduceContext {
  now: IsoDateTime;
}

/**
 * Единственное место, где происходят переходы состояний (ADR 0002).
 * Чистая функция: время приходит извне, компоненты сюда не заглядывают.
 *
 * Недопустимый переход не бросает исключение и не меняет состояние — он
 * попадает в журнал как отклонённый. Guard'ы не дают интерфейсу отправить
 * такое событие, но если это произошло, потеряться оно не должно.
 */
export function reduce(state: DomainState, event: DomainEvent, ctx: ReduceContext): DomainState {
  switch (event.type) {
    case "BookingRequested": {
      if (state.bookings[event.bookingId]) {
        return reject(state, event, ctx, "A booking with this id already exists");
      }
      // Ставку публикует ситтер: бронь замораживает его цену в момент запроса,
      // и позже она уже не переоценивается (ADR 0003). Ситтера проверяем
      // потому, что разыменовываем: семью и питомца редьюсер только сравнивает
      // по идентификатору, падать на них не на чем.
      const sitter = state.sitters[event.sitterId];
      if (!sitter) return reject(state, event, ctx, "Sitter not found");
      const booking: Booking = {
        id: event.bookingId,
        familyId: event.familyId,
        sitterId: event.sitterId,
        petId: event.petId,
        startDate: event.startDate,
        endDate: event.endDate,
        slots: event.slots,
        ratePerVisitMinor: sitter.ratePerVisitMinor,
        status: "requested",
        meetGreet: initialMeetGreet(state, event.familyId, event.sitterId),
        keys: { handover: initialKeyHandover(), return: initialKeyHandover() },
        requestedAt: ctx.now,
      };
      return commit(state, event, ctx, {
        bookings: { ...state.bookings, [booking.id]: booking },
      });
    }

    case "BookingAccepted": {
      const guard = canRespondToBooking(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      // Принятая бронь разворачивается в визиты — единицы работы и начисления.
      const accepted = readiness({
        ...state.bookings[event.bookingId],
        status: "confirmed",
        respondedAt: ctx.now,
      });
      return commit(state, event, ctx, {
        bookings: { ...state.bookings, [accepted.id]: accepted },
        visits: { ...state.visits, ...byId(expandVisits(accepted)) },
      });
    }

    case "BookingDeclined": {
      const guard = canRespondToBooking(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      return commitBooking(state, event, ctx, {
        ...state.bookings[event.bookingId],
        status: "declined",
        respondedAt: ctx.now,
        declineReason: event.reason,
      });
    }

    case "BookingCancelled": {
      const guard = canCancelBooking(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const cancelled: Booking = {
        ...state.bookings[event.bookingId],
        status: "cancelled",
        cancelledAt: ctx.now,
      };
      return commit(state, event, ctx, {
        bookings: { ...state.bookings, [cancelled.id]: cancelled },
        visits: mapVisits(state, cancelled.id, (visit) =>
          visit.status === "scheduled" ? { ...visit, status: "cancelled" } : visit,
        ),
      });
    }

    case "MeetGreetProposed": {
      const guard = canProposeMeetGreet(state, event.bookingId, event.by);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      return commitBooking(state, event, ctx, {
        ...state.bookings[event.bookingId],
        meetGreet: { status: "proposed", proposedBy: event.by, meetingAt: event.meetingAt },
      });
    }

    case "MeetGreetAccepted": {
      const guard = canAcceptMeetGreet(state, event.bookingId, event.by);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const booking = state.bookings[event.bookingId];
      return commitBooking(state, event, ctx, {
        ...booking,
        meetGreet: { ...booking.meetGreet, status: "accepted" },
      });
    }

    case "MeetGreetHappened": {
      const guard = canMarkMeetGreetHappened(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const booking = state.bookings[event.bookingId];
      return commitBooking(
        state,
        event,
        ctx,
        readiness({ ...booking, meetGreet: { ...booking.meetGreet, status: "happened" } }),
      );
    }

    case "KeyHandoverProposed": {
      const guard = canProposeKeyHandover(state, event.bookingId, event.direction, event.by);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const booking = state.bookings[event.bookingId];
      // Предложивший подтверждает передачу самим фактом предложения,
      // но одного подтверждения всё равно недостаточно.
      const handover: KeyHandover = {
        status: "proposed",
        method: event.method,
        meetingAt: event.meetingAt,
        details: event.details,
        proposedBy: event.by,
        confirmedByFamily: event.by === "family",
        confirmedBySitter: event.by === "sitter",
      };
      return commitBooking(state, event, ctx, {
        ...booking,
        keys: { ...booking.keys, [event.direction]: handover },
      });
    }

    case "KeyHandoverConfirmed": {
      const guard = canConfirmKeyHandover(state, event.bookingId, event.direction, event.by);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const booking = state.bookings[event.bookingId];
      const current = booking.keys[event.direction];
      const confirmed: KeyHandover = {
        ...current,
        confirmedByFamily: current.confirmedByFamily || event.by === "family",
        confirmedBySitter: current.confirmedBySitter || event.by === "sitter",
      };
      const settled: KeyHandover = {
        ...confirmed,
        status:
          confirmed.confirmedByFamily && confirmed.confirmedBySitter ? "done" : confirmed.status,
      };
      return commitBooking(
        state,
        event,
        ctx,
        readiness({ ...booking, keys: { ...booking.keys, [event.direction]: settled } }),
      );
    }

    case "VisitCheckedIn": {
      const guard = canCheckIn(state, event.visitId, ctx.now);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const visit = state.visits[event.visitId];
      const booking = state.bookings[visit.bookingId];
      // Первый приход переводит бронь в работу.
      const started: Booking =
        booking.status === "readyToStart"
          ? { ...booking, status: "inProgress", startedAt: ctx.now }
          : booking;
      return commit(state, event, ctx, {
        bookings: { ...state.bookings, [started.id]: started },
        visits: {
          ...state.visits,
          [visit.id]: { ...visit, status: "checkedIn", checkedInAt: ctx.now },
        },
      });
    }

    case "VisitReportSaved": {
      const guard = canSaveVisitReport(state, event.visitId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const existing = state.reports[event.visitId];
      const report: VisitReport = {
        ...existing,
        visitId: event.visitId,
        tasks: event.tasks,
        note: event.note,
        photos: event.photos,
        status: "draft",
        updatedAt: ctx.now,
      };
      return commit(state, event, ctx, {
        reports: { ...state.reports, [report.visitId]: report },
      });
    }

    case "VisitReportSubmitted": {
      const guard = canSubmitVisitReport(state, event.visitId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const report = state.reports[event.visitId];
      const visit = state.visits[event.visitId];
      // Отправка отчёта — то, что завершает визит.
      return commit(state, event, ctx, {
        reports: {
          ...state.reports,
          [event.visitId]: { ...report, status: "submitted", submittedAt: ctx.now },
        },
        visits: {
          ...state.visits,
          [visit.id]: { ...visit, status: "completed", completedAt: ctx.now },
        },
      });
    }

    case "VisitReportRead": {
      const guard = canMarkReportRead(state, event.visitId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const report = state.reports[event.visitId];
      return commit(state, event, ctx, {
        reports: { ...state.reports, [event.visitId]: { ...report, readByFamilyAt: ctx.now } },
      });
    }

    case "VisitMissed": {
      const guard = canMarkVisitMissed(state, event.visitId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const visit = state.visits[event.visitId];
      // Начисления по пропущенному визиту не будет: Earning считается только по
      // завершённым визитам, поэтому отдельного правила про деньги здесь нет.
      return commit(state, event, ctx, {
        visits: {
          ...state.visits,
          [visit.id]: {
            ...visit,
            status: "missed",
            missedAt: ctx.now,
            missedReason: event.reason,
            checkedInAt: undefined,
          },
        },
      });
    }

    case "BookingTerminatedEarly": {
      const guard = canTerminateEarly(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      const terminated: Booking = {
        ...state.bookings[event.bookingId],
        status: "terminatedEarly",
        terminatedAt: ctx.now,
        terminatedBy: event.by,
        terminationReason: event.reason,
      };
      // Оставшиеся визиты отменены, а не пропущены: их не сорвали, от них
      // отказались — поэтому они уходят и из плана периода.
      return commit(state, event, ctx, {
        bookings: { ...state.bookings, [terminated.id]: terminated },
        visits: mapVisits(state, terminated.id, (visit) =>
          visit.status === "scheduled" ? { ...visit, status: "cancelled" } : visit,
        ),
      });
    }

    case "HandbackRequested": {
      const guard = canRequestHandback(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      return commitBooking(state, event, ctx, {
        ...state.bookings[event.bookingId],
        status: "awaitingHandback",
        handbackRequestedAt: ctx.now,
      });
    }

    case "PayoutRequested": {
      if (state.payouts[event.payoutId]) {
        return reject(state, event, ctx, "A payout with this id already exists");
      }
      const guard = canRequestPayout(state, event.sitterId, event.visitIds);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      // В прототипе вывод мгновенный: запрошен — значит выплачен.
      const payout: Payout = {
        id: event.payoutId,
        sitterId: event.sitterId,
        visitIds: event.visitIds,
        paidAt: ctx.now,
      };
      return commit(state, event, ctx, {
        payouts: { ...state.payouts, [payout.id]: payout },
      });
    }

    case "HandbackConfirmed": {
      const guard = canConfirmHandback(state, event.bookingId);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      // Закрытие брони — и есть разблокировка денег: начисления считаются
      // проекцией, поэтому отдельного события про деньги здесь нет (ADR 0001).
      return commitBooking(state, event, ctx, {
        ...state.bookings[event.bookingId],
        status: "completed",
        completedAt: ctx.now,
        closedBy: "family",
      });
    }

    case "HandbackDisputed": {
      const guard = canDisputeHandback(state, event.bookingId, event.reason);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      // Деньги остаются заблокированными: available бывает только у закрытой
      // брони (ADR 0001), поэтому отдельного правила про блокировку здесь нет.
      return commitBooking(state, event, ctx, {
        ...state.bookings[event.bookingId],
        status: "disputed",
        disputedAt: ctx.now,
        disputeReason: event.reason.trim(),
      });
    }

    case "HandbackAutoConfirmed": {
      const guard = canAutoConfirmHandback(state, event.bookingId, ctx.now);
      if (!guard.allowed) return reject(state, event, ctx, guard.reason);
      // Молчание в течение окна — то же закрытие, но видно, чем оно вызвано.
      return commitBooking(state, event, ctx, {
        ...state.bookings[event.bookingId],
        status: "completed",
        completedAt: ctx.now,
        closedBy: "timeout",
      });
    }
  }
}

/** Последовательность событий — удобно и для тестов, и для сид-данных. */
export function reduceAll(
  state: DomainState,
  events: DomainEvent[],
  ctx: ReduceContext,
): DomainState {
  return events.reduce((acc, event) => reduce(acc, event, ctx), state);
}

/**
 * Гейт готовности: бронь уходит в readyToStart только когда знакомство
 * состоялось (или пропущено) и ключи переданы. Пересчитывается после каждого
 * события, которое могло сдвинуть одно из двух предусловий.
 */
function readiness(booking: Booking): Booking {
  if (booking.status !== "confirmed") return booking;
  const ready = meetGreetSettled(booking) && booking.keys.handover.status === "done";
  return ready ? { ...booking, status: "readyToStart" } : booking;
}

/** Повторная бронь с тем же ситтером знакомство пропускает. */
function initialMeetGreet(state: DomainState, familyId: string, sitterId: string): MeetGreet {
  const alreadyMet = Object.values(state.bookings).some(
    (booking) =>
      booking.familyId === familyId &&
      booking.sitterId === sitterId &&
      meetGreetSettled(booking),
  );
  return { status: alreadyMet ? "skipped" : "none" };
}

function initialKeyHandover(): KeyHandover {
  return { status: "pending", confirmedByFamily: false, confirmedBySitter: false };
}

function byId(visits: Visit[]): Record<string, Visit> {
  return Object.fromEntries(visits.map((visit) => [visit.id, visit]));
}

function mapVisits(
  state: DomainState,
  bookingId: string,
  update: (visit: Visit) => Visit,
): Record<string, Visit> {
  return Object.fromEntries(
    Object.entries(state.visits).map(([id, visit]) => [
      id,
      visit.bookingId === bookingId ? update(visit) : visit,
    ]),
  );
}

function commit(
  state: DomainState,
  event: DomainEvent,
  ctx: ReduceContext,
  patch: Partial<DomainState>,
): DomainState {
  return { ...state, ...patch, journal: [...state.journal, entry(event, ctx)] };
}

function commitBooking(
  state: DomainState,
  event: DomainEvent,
  ctx: ReduceContext,
  booking: Booking,
): DomainState {
  return commit(state, event, ctx, { bookings: { ...state.bookings, [booking.id]: booking } });
}

function reject(
  state: DomainState,
  event: DomainEvent,
  ctx: ReduceContext,
  rejection: string,
): DomainState {
  return { ...state, journal: [...state.journal, { ...entry(event, ctx), rejection }] };
}

function entry(event: DomainEvent, ctx: ReduceContext): JournalEntry {
  return { at: ctx.now, event };
}
