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
      <Step title="Meet & greet" state="done">
        <StepNote>You’ve met on a previous booking — this step is skipped.</StepNote>
      </Step>
    );
  }

  if (meetGreet.status === "happened") {
    return (
      <Step title="Meet & greet" state="done">
        <StepNote>Took place {meetGreet.meetingAt && formatDateTime(meetGreet.meetingAt)}.</StepNote>
      </Step>
    );
  }

  const stepState = meetGreet.status === "accepted" ? "waiting" : "todo";

  return (
    <Step title="Meet the family and the pet" state={stepState}>
      {meetGreet.status === "proposed" && meetGreet.meetingAt && (
        <StepNote>
          {meetGreet.proposedBy === "family" ? "The family" : "The sitter"} proposed{" "}
          {formatDateTime(meetGreet.meetingAt)}.{" "}
          {meetGreet.proposedBy === role ? "Waiting on the other side." : "Your move."}
        </StepNote>
      )}

      {meetGreet.status === "accepted" && meetGreet.meetingAt && (
        <StepNote>
          Time agreed: {formatDateTime(meetGreet.meetingAt)}. Once you’ve met, mark the meet &
          greet as done.
        </StepNote>
      )}

      <div className="flex flex-wrap items-start gap-3">
        {meetGreet.status === "proposed" && (
          <GuardedButton
            guard={acceptGuard}
            onClick={() => dispatch({ type: "MeetGreetAccepted", bookingId: booking.id, by: role })}
          >
            Accept this time
          </GuardedButton>
        )}

        {meetGreet.status === "accepted" && (
          <GuardedButton
            guard={happenedGuard}
            onClick={() => dispatch({ type: "MeetGreetHappened", bookingId: booking.id })}
          >
            Meet & greet happened
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
              {meetGreet.status === "proposed" ? "Propose another time" : "Propose a time"}
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
