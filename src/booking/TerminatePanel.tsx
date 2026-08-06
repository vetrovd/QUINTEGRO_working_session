import { useState } from "react";
import { canTerminateEarly } from "../domain/guards";
import type { Booking, Role } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateTime } from "../app/format";
import { GuardedButton, inputClass } from "../app/ui";
import { Step, StepNote } from "./Step";

/**
 * Досрочное прерывание: семья вернулась раньше или ситтер выбыл. Это не отмена
 * брони — прерванная опека всё равно закрывается через возврат ключей и сдачу
 * работы, иначе прерывание стало бы дырой в деньгах.
 */
export function TerminatePanel({ booking, role }: { booking: Booking; role: Role }) {
  const { state, dispatch } = useStore();
  const [reason, setReason] = useState("");
  const terminated = booking.status === "terminatedEarly";
  const guard = canTerminateEarly(state, booking.id);

  if (!terminated && !guard.allowed) return null;

  return (
    <Step title="Ending care early" state={terminated ? "done" : "todo"}>
      {terminated ? (
        <StepNote>
          Care ended {booking.terminatedAt && formatDateTime(booking.terminatedAt)}, called by{" "}
          {booking.terminatedBy === "family" ? "the family" : "the sitter"}
          {booking.terminationReason && `: “${booking.terminationReason}”`}. Remaining visits are
          dropped, but the booking still has to be closed — key return and handing back the work are
          below.
        </StepNote>
      ) : (
        <>
          <StepNote>
            If care stops before the end date, the remaining visits are dropped and only the ones
            that happened are paid for.
          </StepNote>
          <div className="flex flex-wrap items-start gap-3">
            <input
              type="text"
              value={reason}
              placeholder="Reason (optional)"
              onChange={(event) => setReason(event.target.value)}
              className={`${inputClass} min-w-56 flex-1`}
            />
            <GuardedButton
              tone="danger"
              guard={guard}
              onClick={() =>
                dispatch({
                  type: "BookingTerminatedEarly",
                  bookingId: booking.id,
                  by: role,
                  reason: reason.trim() || undefined,
                })
              }
            >
              End care early
            </GuardedButton>
          </div>
        </>
      )}
    </Step>
  );
}
