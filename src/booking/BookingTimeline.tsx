import { canStartCare } from "../domain/guards";
import { timelineOf } from "../domain/timeline";
import type { StepPhase } from "../domain/timeline";
import { visitsOfBooking } from "../domain/visits";
import type { Booking, Role } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateTime } from "../app/format";
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
      <RequestStep booking={booking} />

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

function RequestStep({ booking }: { booking: Booking }) {
  if (booking.status === "declined") {
    return (
      <Step
        title="Request"
        state="blocked"
        record={`Declined by the sitter${booking.declineReason ? `: "${booking.declineReason}"` : ""}.`}
      />
    );
  }
  if (booking.status === "cancelled") {
    return (
      <Step
        title="Request"
        state="blocked"
        record={`Canceled${booking.cancelledAt ? ` ${formatDateTime(booking.cancelledAt)}` : ""}.`}
      />
    );
  }
  if (booking.status === "requested") {
    return (
      <Step title="Request sent" state="current" record="Waiting on the sitter to accept." />
    );
  }
  return (
    <Step
      title="Request accepted"
      state="done"
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
      state={phase === "deadEnd" ? "blocked" : phase}
      reason={guard.allowed ? undefined : guard.reason}
    >
      {started && (
        <>
          {role === "sitter" && (
            <StepNote>Check in and file reports from the Schedule tab.</StepNote>
          )}
          <VisitFeed bookingId={booking.id} role={role} />
        </>
      )}
    </Step>
  );
}
