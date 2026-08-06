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
export function HandbackPanel({ booking, role }: { booking: Booking; role: Role }) {
  const { state, dispatch, now } = useStore();
  const [reason, setReason] = useState("");
  const summary = handbackSummary(state, booking.id);
  const awaiting = booking.status === "awaitingHandback";
  const closed = booking.status === "completed";
  const disputed = booking.status === "disputed";
  const timeLeftMs = handbackTimeLeftMs(booking, now);

  return (
    <Step
      title="Сдача работы"
      state={disputed ? "blocked" : closed ? "done" : awaiting ? "waiting" : "todo"}
    >
      <StepNote>
        Визитов состоялось {summary.completed} из {summary.planned} по плану периода
        {summary.missed > 0 && `, не состоялось ${summary.missed}`}
        {summary.cancelled > 0 && `, снято прерыванием ${summary.cancelled}`}
        {summary.unaccounted > 0 && `, без отметки ${summary.unaccounted}`}.{" "}
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

      {disputed && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-red-900">
          <p>
            <strong>Семья оспорила закрытие</strong>
            {booking.disputedAt && ` ${formatDateTime(booking.disputedAt)}`}: «
            {booking.disputeReason}».
          </p>
          {/* Тупик показан честно: роли, которая разбирает спор, в прототипе нет. */}
          <p className="mt-1">
            Деньги ситтера остаются заблокированными до разбора. Разбор — участие поддержки, которой
            в прототипе нет, поэтому дальше бронь не двигается: это край модели, а не ошибка.
          </p>
        </div>
      )}

      {closed && (
        <StepNote>
          Бронь закрыта{booking.completedAt && ` ${formatDateTime(booking.completedAt)}`}
          {booking.closedBy === "timeout"
            ? `: семья не ответила за ${HANDBACK_WINDOW_HOURS} ч, молчание считается согласием`
            : " подтверждением семьи"}{" "}
          — деньги ситтера разблокированы.
        </StepNote>
      )}

      {!closed && !disputed && (
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

          {role === "sitter" ? (
            <div className="flex flex-wrap items-start gap-3">
              <GuardedButton
                guard={canRequestHandback(state, booking.id)}
                onClick={() => dispatch({ type: "HandbackRequested", bookingId: booking.id })}
              >
                Сдать работу
              </GuardedButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-3">
              <GuardedButton
                guard={canConfirmHandback(state, booking.id)}
                onClick={() => dispatch({ type: "HandbackConfirmed", bookingId: booking.id })}
              >
                Подтвердить закрытие
              </GuardedButton>
              <input
                type="text"
                value={reason}
                placeholder="Что пошло не так"
                onChange={(event) => setReason(event.target.value)}
                className={`${inputClass} min-w-56 flex-1`}
              />
              <GuardedButton
                tone="danger"
                guard={canDisputeHandback(state, booking.id, reason)}
                onClick={() =>
                  dispatch({ type: "HandbackDisputed", bookingId: booking.id, reason })
                }
              >
                Оспорить
              </GuardedButton>
            </div>
          )}
        </>
      )}
    </Step>
  );
}
