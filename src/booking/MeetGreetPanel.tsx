import { useState } from "react";
import { canAcceptMeetGreet, canMarkMeetGreetHappened, canProposeMeetGreet } from "../domain/guards";
import type { Booking, Role } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateTime, fromDateTimeInput, toDateTimeInput } from "../app/format";
import { GuardedButton, inputClass } from "../app/ui";
import { Step, StepNote } from "./Step";

/** Знакомство: предложение, встречное предложение, принятие, «состоялось». */
export function MeetGreetPanel({ booking, role }: { booking: Booking; role: Role }) {
  const { dispatch, state, now } = useStore();
  const { meetGreet } = booking;
  const [meetingAt, setMeetingAt] = useState(() => toDateTimeInput(defaultMeetingTime(now)));

  const proposeGuard = canProposeMeetGreet(state, booking.id, role);
  const acceptGuard = canAcceptMeetGreet(state, booking.id, role);
  const happenedGuard = canMarkMeetGreetHappened(state, booking.id);

  if (meetGreet.status === "skipped") {
    return (
      <Step title="Знакомство" state="done">
        <StepNote>Вы уже знакомы по прошлой броне — шаг пропущен.</StepNote>
      </Step>
    );
  }

  if (meetGreet.status === "happened") {
    return (
      <Step title="Знакомство" state="done">
        <StepNote>Состоялось {meetGreet.meetingAt && formatDateTime(meetGreet.meetingAt)}.</StepNote>
      </Step>
    );
  }

  const stepState = meetGreet.status === "accepted" ? "waiting" : "todo";

  return (
    <Step title="Знакомство с семьёй и питомцем" state={stepState}>
      {meetGreet.status === "proposed" && meetGreet.meetingAt && (
        <StepNote>
          Предложено {formatDateTime(meetGreet.meetingAt)} со стороны{" "}
          {meetGreet.proposedBy === "family" ? "семьи" : "ситтера"}.{" "}
          {meetGreet.proposedBy === role ? "Ждём ответа второй стороны." : "Ваш ход."}
        </StepNote>
      )}

      {meetGreet.status === "accepted" && meetGreet.meetingAt && (
        <StepNote>
          Время согласовано: {formatDateTime(meetGreet.meetingAt)}. После встречи отметьте, что
          знакомство состоялось.
        </StepNote>
      )}

      <div className="flex flex-wrap items-start gap-3">
        {meetGreet.status === "proposed" && (
          <GuardedButton
            guard={acceptGuard}
            onClick={() => dispatch({ type: "MeetGreetAccepted", bookingId: booking.id, by: role })}
          >
            Принять время
          </GuardedButton>
        )}

        {meetGreet.status === "accepted" && (
          <GuardedButton
            guard={happenedGuard}
            onClick={() => dispatch({ type: "MeetGreetHappened", bookingId: booking.id })}
          >
            Знакомство состоялось
          </GuardedButton>
        )}

        {meetGreet.status !== "accepted" && (
          <>
            <input
              type="datetime-local"
              value={meetingAt}
              onChange={(event) => setMeetingAt(event.target.value)}
              className={inputClass}
            />
            <GuardedButton
              tone="neutral"
              guard={proposeGuard}
              onClick={() =>
                dispatch({
                  type: "MeetGreetProposed",
                  bookingId: booking.id,
                  by: role,
                  meetingAt: fromDateTimeInput(meetingAt),
                })
              }
            >
              {meetGreet.status === "proposed" ? "Предложить другое время" : "Предложить время"}
            </GuardedButton>
          </>
        )}
      </div>
    </Step>
  );
}

function defaultMeetingTime(now: string): string {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
}
