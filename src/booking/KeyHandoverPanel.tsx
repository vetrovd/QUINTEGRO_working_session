import { useState } from "react";
import {
  awaitingConfirmationFrom,
  canConfirmKeyHandover,
  canProposeKeyHandover,
} from "../domain/guards";
import type { Booking, KeyHandoverDirection, KeyHandoverMethod, Role } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import {
  awaitingLabel,
  formatDateTime,
  fromDateTimeInput,
  methodLabel,
  toDateTimeInput,
} from "../app/format";
import { Field, GuardedButton, inputClass } from "../app/ui";
import { Step, StepNote } from "./Step";

const METHODS: KeyHandoverMethod[] = ["inPerson", "lockbox", "doorCode"];

/**
 * Передача доступа в дом. Состоявшейся считается только та, что подтверждена
 * обеими сторонами — предложивший подтверждает фактом предложения.
 */
export function KeyHandoverPanel({
  booking,
  role,
  direction,
}: {
  booking: Booking;
  role: Role;
  direction: KeyHandoverDirection;
}) {
  const { dispatch, state, now } = useStore();
  const handover = booking.keys[direction];
  const [method, setMethod] = useState<KeyHandoverMethod>(handover.method ?? "inPerson");
  const [meetingAt, setMeetingAt] = useState(() => toDateTimeInput(now));
  const [details, setDetails] = useState("");

  const title = direction === "handover" ? "Key handoff" : "Key return";
  const proposeGuard = canProposeKeyHandover(state, booking.id, direction, role);
  const confirmGuard = canConfirmKeyHandover(state, booking.id, direction, role);
  const awaiting = awaitingConfirmationFrom(booking, direction);

  if (handover.status === "done") {
    return (
      <Step title={title} state="done">
        <StepNote>
          {handover.method && methodLabel(handover.method)}
          {handover.meetingAt && `, ${formatDateTime(handover.meetingAt)}`} — confirmed by both
          sides.
        </StepNote>
      </Step>
    );
  }

  return (
    <Step title={title} state={handover.status === "proposed" ? "waiting" : "todo"}>
      {handover.status === "proposed" && (
        <>
          <StepNote>
            {handover.method && methodLabel(handover.method)}
            {handover.meetingAt && `, ${formatDateTime(handover.meetingAt)}`}
            {handover.details && ` — ${handover.details}`}
          </StepNote>
          <StepNote>
            <strong>Waiting on {awaitingLabel(awaiting)} to confirm.</strong> With only one side
            confirmed, the handoff hasn't happened.
          </StepNote>
        </>
      )}

      <div className="flex flex-wrap items-start gap-3">
        {handover.status === "proposed" && (
          <GuardedButton
            guard={confirmGuard}
            onClick={() =>
              dispatch({ type: "KeyHandoverConfirmed", bookingId: booking.id, direction, by: role })
            }
          >
            Confirm the handoff
          </GuardedButton>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Method">
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as KeyHandoverMethod)}
            className={inputClass}
          >
            {METHODS.map((item) => (
              <option key={item} value={item}>
                {methodLabel(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="When">
          <input
            type="datetime-local"
            value={meetingAt}
            onChange={(event) => setMeetingAt(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Where / details">
          <input
            type="text"
            value={details}
            placeholder="e.g. lockbox on the gate"
            onChange={(event) => setDetails(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <GuardedButton
          tone="neutral"
          guard={proposeGuard}
          onClick={() =>
            dispatch({
              type: "KeyHandoverProposed",
              bookingId: booking.id,
              direction,
              by: role,
              method,
              meetingAt: fromDateTimeInput(meetingAt),
              details: details.trim() || undefined,
            })
          }
        >
          {handover.status === "proposed" ? "Propose something else" : "Propose a handoff"}
        </GuardedButton>
      </div>
    </Step>
  );
}
