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

  if (terminated) {
    return (
      <Step
        title="Care ended early"
        state="done"
        record={`Ended${booking.terminatedAt ? ` ${formatDateTime(booking.terminatedAt)}` : ""}, called by ${
          booking.terminatedBy === "family" ? "the family" : "the sitter"
        }${booking.terminationReason ? `: "${booking.terminationReason}"` : ""}. Remaining visits dropped.`}
      />
    );
  }

  // Развилка, а не шаг пути, — но и её не прячем: недоступное действие видно с
  // причиной, иначе прототип молчит ровно там, где должен объяснять. Когда
  // развилка открыта, она и выглядит открытой: рисовать доступное действие
  // цветом «предстоит» значит врать ровно тем цветом, которым прототип
  // объясняет, что действие недоступно.
  return (
    <Step
      title="End care early"
      state={guard.allowed ? "fork" : "future"}
      reason={guard.allowed ? undefined : guard.reason}
    >
      {guard.allowed && (
        <>
          <StepNote>
            If care stops before the end date, the remaining visits are dropped and only the ones
            that happened are paid for. The booking still has to be closed afterwards.
          </StepNote>
          <div className="flex flex-col items-start gap-3">
            <input
              type="text"
              value={reason}
              placeholder="Reason (optional)"
              onChange={(event) => setReason(event.target.value)}
              className={`${inputClass} w-full`}
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
