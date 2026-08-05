import { canConfirmHandback, canRequestHandback } from "../domain/guards";
import { HANDBACK_WINDOW_HOURS, handbackSummary, handbackTimeLeftMs } from "../domain/handback";
import { formatMoney } from "../domain/money";
import type { Booking, Role } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { formatDateTime, formatDuration } from "../app/format";
import { GuardedButton } from "../app/ui";
import { Step, StepNote } from "./Step";

/**
 * Сдача работы: ситтер заявляет закрытие, семья подтверждает. Это единственная
 * точка, где деньги ситтера становятся доступными (ADR 0001), поэтому семья
 * видит сводку до нажатия, а не после.
 */
export function HandbackPanel({ booking, role }: { booking: Booking; role: Role }) {
  const { state, dispatch, now } = useStore();
  const summary = handbackSummary(state, booking.id);
  const awaiting = booking.status === "awaitingHandback";
  const closed = booking.status === "completed";
  const timeLeftMs = handbackTimeLeftMs(booking, now);

  return (
    <Step title="Сдача работы" state={closed ? "done" : awaiting ? "waiting" : "todo"}>
      <StepNote>
        Визитов состоялось {summary.completed} из {summary.planned}
        {summary.notCompleted > 0 && `, не состоялось ${summary.notCompleted}`}.{" "}
        {role === "family" ? (
          <>
            К оплате — <strong>{formatMoney(summary.grossMinor)}</strong>: только за визиты со
            сданным отчётом.
          </>
        ) : (
          <>
            К начислению — <strong>{formatMoney(summary.netMinor)}</strong> на руки (
            {formatMoney(summary.grossMinor)} до комиссии, комиссия {formatMoney(summary.feeMinor)}).
          </>
        )}
      </StepNote>

      {closed ? (
        <StepNote>
          Бронь закрыта{booking.completedAt && ` ${formatDateTime(booking.completedAt)}`}
          {booking.closedBy === "timeout"
            ? `: семья не ответила за ${HANDBACK_WINDOW_HOURS} ч, молчание считается согласием`
            : " подтверждением семьи"}{" "}
          — деньги ситтера разблокированы.
        </StepNote>
      ) : (
        <>
          {awaiting && (
            <>
              <StepNote>
                <strong>
                  {role === "family"
                    ? "Ситтер заявил сдачу работы — ждём вашего подтверждения."
                    : "Ждём подтверждения семьи."}
                </strong>{" "}
                Подтверждение закрывает бронь и разблокирует выплату ситтеру.
              </StepNote>
              {/* Молчание семьи — тоже согласие: иначе бронь висит незакрытой,
                  а ситтер остаётся без денег (ADR 0001). */}
              <StepNote>
                {role === "family"
                  ? `Если не ответить, бронь закроется сама через ${formatDuration(timeLeftMs)} — молчание считается согласием.`
                  : `Если семья не ответит, бронь закроется сама через ${formatDuration(timeLeftMs)}, и деньги разблокируются.`}
              </StepNote>
            </>
          )}

          <div className="flex flex-wrap items-start gap-3">
            {role === "sitter" ? (
              <GuardedButton
                guard={canRequestHandback(state, booking.id)}
                onClick={() => dispatch({ type: "HandbackRequested", bookingId: booking.id })}
              >
                Сдать работу
              </GuardedButton>
            ) : (
              <GuardedButton
                guard={canConfirmHandback(state, booking.id)}
                onClick={() => dispatch({ type: "HandbackConfirmed", bookingId: booking.id })}
              >
                Подтвердить закрытие
              </GuardedButton>
            )}
          </div>
        </>
      )}
    </Step>
  );
}
