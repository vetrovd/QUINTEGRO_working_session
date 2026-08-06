import { meetGreetSettled } from "../domain/guards";
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
 * Свернуть можно, скрыть нельзя: если убрать будущие шаги с экрана, прототип
 * перестанет показывать единственное, ради чего его строили, — что действие
 * недоступно и почему.
 */
export function BookingTimeline({ booking, role }: { booking: Booking; role: Role }) {
  const { state } = useStore();

  const visits = visitsOfBooking(state, booking.id);
  const openVisits = visits.filter(
    (visit) => visit.status === "scheduled" || visit.status === "checkedIn",
  ).length;
  const settled =
    booking.status === "requested" ||
    booking.status === "declined" ||
    booking.status === "cancelled";

  const done = {
    meetGreet: meetGreetSettled(booking),
    keysOut: booking.keys.handover.status === "done",
    // Опека закончилась, когда визиты были и ни одного незакрытого не осталось:
    // досрочное прерывание снимает оставшиеся, и путь идёт дальше тем же
    // порядком. До принятия брони визитов ещё нет — это не «всё сделано».
    care: !settled && visits.length > 0 && openVisits === 0,
    keysBack: booking.keys.return.status === "done",
    handback: booking.status === "completed" || booking.status === "disputed",
  };

  const order = ["meetGreet", "keysOut", "care", "keysBack", "handback"] as const;
  const current = settled ? undefined : order.find((step) => !done[step]);

  return (
    <ol className="flex flex-col">
      <RequestStep booking={booking} />

      <MeetGreetPanel booking={booking} role={role} expanded={current === "meetGreet"} />
      <KeyHandoverPanel
        booking={booking}
        role={role}
        direction="handover"
        expanded={current === "keysOut"}
      />
      <CareStep
        booking={booking}
        role={role}
        expanded={current === "care"}
        done={done.care}
        started={visits.some((visit) => visit.status !== "scheduled")}
      />
      <TerminatePanel booking={booking} role={role} />
      <KeyHandoverPanel
        booking={booking}
        role={role}
        direction="return"
        expanded={current === "keysBack"}
      />
      <HandbackPanel booking={booking} role={role} expanded={current === "handback"} />
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
  expanded,
  done,
  started,
}: {
  booking: Booking;
  role: Role;
  expanded: boolean;
  done: boolean;
  started: boolean;
}) {
  return (
    <Step
      title="Visits"
      state={done ? "done" : expanded ? "current" : "future"}
      reason={started ? undefined : "Starts once the keys are handed over."}
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
