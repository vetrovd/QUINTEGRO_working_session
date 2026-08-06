import { canStartCare } from "../domain/guards";
import { timelineOf } from "../domain/timeline";
import type { StepPhase } from "../domain/timeline";
import { visitsOfBooking } from "../domain/visits";
import type { Booking, DomainState, Role, VisitStatus } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateTime, plural } from "../app/format";
import { routeToHash } from "../app/routes";
import { HandbackPanel } from "./HandbackPanel";
import { KeyHandoverPanel } from "./KeyHandoverPanel";
import { MeetGreetPanel } from "./MeetGreetPanel";
import { Step, StepNote } from "./Step";
import { TerminatePanel } from "./TerminatePanel";
import { VisitFeed } from "./VisitFeed";

/**
 * Весь путь брони одной лентой сверху вниз. Раскрыт ровно один шаг — тот, что
 * сейчас в работе; пройденные свёрнуты в строку-запись, будущие остаются
 * видимыми с причиной блокировки.
 *
 * Где именно находится бронь, считает домен (`timelineOf`): порядок шагов —
 * это модель пути, а не оформление. Здесь остаётся только отрисовка.
 *
 * Свернуть можно, скрыть нельзя: если убрать будущие шаги с экрана, прототип
 * перестанет показывать единственное, ради чего его строили, — что действие
 * недоступно и почему.
 */
export function BookingTimeline({ booking, role }: { booking: Booking; role: Role }) {
  const { state } = useStore();
  const steps = timelineOf(state, booking.id);

  return (
    <ol className="flex flex-col">
      <RequestStep booking={booking} phase={steps.request} />

      <MeetGreetPanel booking={booking} role={role} expanded={steps.meetGreet === "current"} />
      <KeyHandoverPanel
        booking={booking}
        role={role}
        direction="handover"
        expanded={steps.keyHandover === "current"}
      />
      <CareStep booking={booking} role={role} phase={steps.care} />
      <TerminatePanel booking={booking} role={role} />
      <KeyHandoverPanel
        booking={booking}
        role={role}
        direction="return"
        expanded={steps.keyReturn === "current"}
      />
      <HandbackPanel booking={booking} role={role} expanded={steps.handback === "current"} />
    </ol>
  );
}

/**
 * Заявка — такой же шаг пути, как остальные, поэтому её фазу считает домен.
 * Здесь остаётся только текст: что именно произошло с этой заявкой.
 */
function RequestStep({ booking, phase }: { booking: Booking; phase: StepPhase }) {
  if (booking.status === "declined") {
    return (
      <Step
        title="Request declined"
        state={phase}
        record={`Declined by the sitter${booking.declineReason ? `: "${booking.declineReason}"` : ""}.`}
      />
    );
  }
  if (booking.status === "cancelled") {
    return (
      <Step
        title="Request canceled"
        state={phase}
        record={`Canceled${booking.cancelledAt ? ` ${formatDateTime(booking.cancelledAt)}` : ""}.`}
      />
    );
  }
  if (booking.status === "requested") {
    return <Step title="Request sent" state={phase} record="Waiting on the sitter to accept." />;
  }
  return (
    <Step
      title="Request accepted"
      state={phase}
      record={booking.respondedAt ? formatDateTime(booking.respondedAt) : undefined}
    />
  );
}

/** Сами визиты: для семьи это лента ухода за питомцем, для ситтера — запись. */
function CareStep({
  booking,
  role,
  phase,
}: {
  booking: Booking;
  role: Role;
  phase: StepPhase;
}) {
  const { state } = useStore();
  // Причина ожидания приходит из того же guard'а, что и запрет: сочинять её
  // здесь значило бы держать второй источник правды о готовности брони.
  const guard = canStartCare(state, booking.id);
  const started = visitsOfBooking(state, booking.id).some((visit) => visit.status !== "scheduled");

  return (
    <Step
      title="Visits"
      state={phase}
      reason={guard.allowed ? undefined : guard.reason}
    >
      {role === "sitter" && <VisitTally booking={booking} state={state} />}
      {started && <VisitFeed bookingId={booking.id} role={role} />}
    </Step>
  );
}

/**
 * Для ситтера визиты здесь — запись, а не работа: сколько их, сколько закрыто
 * и сколько осталось. Ни одной кнопки: приход, пропуск и отчёт живут в
 * расписании, и у действия не должно быть двух домов — только переход туда.
 */
function VisitTally({ booking, state }: { booking: Booking; state: DomainState }) {
  const visits = visitsOfBooking(state, booking.id).filter((visit) => visit.status !== "cancelled");
  if (visits.length === 0) return null;

  const count = (...statuses: VisitStatus[]) =>
    visits.filter((visit) => statuses.includes(visit.status)).length;
  const tally = [
    [count("completed"), "reported"],
    [count("missed"), "missed"],
    [count("scheduled", "checkedIn"), "still ahead"],
  ] as const;

  return (
    <StepNote>
      {plural(visits.length, "visit")} ·{" "}
      {tally
        .filter(([number]) => number > 0)
        .map(([number, label]) => `${number} ${label}`)
        .join(", ")}
      .{" "}
      <a
        href={routeToHash({ role: "sitter", screen: "schedule" })}
        className="text-stone-500 underline underline-offset-2 transition hover:text-stone-900"
      >
        Check in and file reports in Schedule <span aria-hidden="true" className="ml-0.5">→</span>
      </a>
    </StepNote>
  );
}
