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
    <Step title="Досрочное прерывание" state={terminated ? "done" : "todo"}>
      {terminated ? (
        <StepNote>
          Опека прервана {booking.terminatedAt && formatDateTime(booking.terminatedAt)} по инициативе{" "}
          {booking.terminatedBy === "family" ? "семьи" : "ситтера"}
          {booking.terminationReason && `: «${booking.terminationReason}»`}. Оставшиеся визиты сняты,
          закрыть бронь всё равно нужно — возврат ключей и сдача работы ниже.
        </StepNote>
      ) : (
        <>
          <StepNote>
            Если опека прекращается раньше срока, оставшиеся визиты снимаются, а начислено будет
            только за состоявшиеся.
          </StepNote>
          <div className="flex flex-wrap items-start gap-3">
            <input
              type="text"
              value={reason}
              placeholder="Причина (необязательно)"
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
              Прервать опеку
            </GuardedButton>
          </div>
        </>
      )}
    </Step>
  );
}
