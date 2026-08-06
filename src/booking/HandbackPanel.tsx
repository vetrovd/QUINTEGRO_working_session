import { useState } from "react";
import { canConfirmHandback, canDisputeHandback, canRequestHandback } from "../domain/guards";
import { HANDBACK_WINDOW_HOURS, handbackSummary, handbackTimeLeftMs } from "../domain/handback";
import { formatMoney } from "../domain/money";
import type { Booking, Role } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateTime, formatDuration } from "../app/format";
import { GuardedButton, inputClass } from "../app/ui";
import { Step, StepNote } from "./Step";

/**
 * Сдача работы: ситтер заявляет закрытие, семья подтверждает или оспаривает.
 * Это единственная точка, где деньги ситтера становятся доступными (ADR 0001),
 * поэтому семья видит сводку до нажатия, а не после.
 */
export function HandbackPanel({
  booking,
  role,
  expanded,
}: {
  booking: Booking;
  role: Role;
  expanded: boolean;
}) {
  const { state, dispatch, now } = useStore();
  const [reason, setReason] = useState("");
  const summary = handbackSummary(state, booking.id);
  const requestGuard = canRequestHandback(state, booking.id);
  const timeLeftMs = handbackTimeLeftMs(booking, now);

  if (booking.status === "disputed") {
    return (
      <Step title="Handing back the work" state="blocked" last>
        <div className="rounded-md bg-red-50 px-3 py-2 text-red-900">
          <p>
            <strong>The family disputed the closing</strong>
            {booking.disputedAt && ` ${formatDateTime(booking.disputedAt)}`}: "
            {booking.disputeReason}".
          </p>
          {/* Тупик показан честно: роли, которая разбирает спор, в прототипе нет. */}
          <p className="mt-1">
            The sitter's money stays locked until this is reviewed. Review means a support role the
            prototype doesn't have, so the booking goes no further: this is the edge of the model,
            not a bug.
          </p>
        </div>
      </Step>
    );
  }

  if (booking.status === "completed") {
    return (
      <Step
        title="Handing back the work"
        state="done"
        last
        record={`Closed${booking.completedAt ? ` ${formatDateTime(booking.completedAt)}` : ""}${
          booking.closedBy === "timeout"
            ? `: no reply within ${HANDBACK_WINDOW_HOURS}h, and silence counts as agreement`
            : " by the family's confirmation"
        } — the sitter's money is unlocked.`}
      />
    );
  }

  const awaiting = booking.status === "awaitingHandback";

  return (
    <Step
      title="Handing back the work"
      state={expanded ? "current" : "future"}
      last
      reason={expanded || requestGuard.allowed ? undefined : requestGuard.reason}
    >
      {expanded && (
        <>
          <StepNote>
            {summary.completed} of {summary.planned} planned visits happened
            {summary.missed > 0 && `, ${summary.missed} missed`}
            {summary.cancelled > 0 && `, ${summary.cancelled} dropped by the early end`}
            {summary.unaccounted > 0 && `, ${summary.unaccounted} unaccounted for`}.{" "}
            {role === "family" ? (
              <>
                Due — <strong>{formatMoney(summary.grossMinor)}</strong>: only for visits with a
                filed report.
              </>
            ) : (
              <>
                You'll earn <strong>{formatMoney(summary.netMinor)}</strong> take-home (
                {formatMoney(summary.grossMinor)} before fees, {formatMoney(summary.feeMinor)}{" "}
                platform fee).
              </>
            )}
          </StepNote>

          {awaiting && (
            <>
              <StepNote>
                <strong>
                  {role === "family"
                    ? "The sitter submitted the work — waiting on your confirmation."
                    : "Waiting on the family to confirm."}
                </strong>{" "}
                Confirming closes the booking and unlocks the sitter's payout.
              </StepNote>
              {/* Молчание семьи — тоже согласие: иначе бронь висит незакрытой,
                  а ситтер остаётся без денег (ADR 0001). */}
              <StepNote>
                {role === "family"
                  ? `If you don't respond, the booking closes itself in ${formatDuration(timeLeftMs)} — silence counts as agreement.`
                  : `If the family doesn't respond, the booking closes itself in ${formatDuration(timeLeftMs)} and the money unlocks.`}
              </StepNote>
            </>
          )}

          {role === "sitter" ? (
            <div>
              <GuardedButton
                guard={requestGuard}
                onClick={() => dispatch({ type: "HandbackRequested", bookingId: booking.id })}
              >
                Hand back the work
              </GuardedButton>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <GuardedButton
                guard={canConfirmHandback(state, booking.id)}
                onClick={() => dispatch({ type: "HandbackConfirmed", bookingId: booking.id })}
              >
                Confirm closing
              </GuardedButton>
              <input
                type="text"
                value={reason}
                placeholder="What went wrong"
                onChange={(event) => setReason(event.target.value)}
                className={`${inputClass} w-full`}
              />
              <GuardedButton
                tone="danger"
                guard={canDisputeHandback(state, booking.id, reason)}
                onClick={() => dispatch({ type: "HandbackDisputed", bookingId: booking.id, reason })}
              >
                Dispute
              </GuardedButton>
            </div>
          )}
        </>
      )}
    </Step>
  );
}
