import { useEffect, useRef, useState } from "react";
import { addDays, today } from "../domain/dates";
import { canCheckIn, canMarkVisitMissed } from "../domain/guards";
import { SEED_SITTER_ID } from "../domain/seed";
import type { DomainState, Visit, VisitId } from "../domain/types";
import { compareVisits, isAwaitingReport, isOverdue } from "../domain/visits";
import { useStore } from "../store/StoreProvider";
import {
  careTaskLabel,
  formatDateRange,
  formatDateWithWeekday,
  formatTime,
  plural,
  slotLabel,
} from "../app/format";
import { scrollIntoScreen } from "../app/PhoneFrame";
import { routeToHash } from "../app/routes";
import { Card, EmptyState, Eyebrow, GuardedButton, inputClass } from "../app/ui";
import { ReportComposer } from "./ReportComposer";

/**
 * Расписание ситтера. Первыми идут просроченные, за ними ждущие отчёта: это
 * прямой ответ на вопрос «где я не закрыл работу». Обе группы считаются теми
 * же предикатами домена, что и отметка на пункте меню, — иначе меню звало бы
 * туда, где ничего не ждёт. Отметка прихода заблокирована, пока передача
 * ключей не подтверждена обеими сторонами.
 */
export function VisitSchedule({ focusVisitId }: { focusVisitId?: VisitId }) {
  const { state, now } = useStore();
  const currentDate = today(now);
  const weekEnd = addDays(currentDate, 7);

  const visits = Object.values(state.visits)
    .filter((visit) => visit.status !== "cancelled")
    .filter((visit) => state.bookings[visit.bookingId].sitterId === SEED_SITTER_ID)
    .sort(compareVisits);

  const upcoming = visits.filter((visit) => visit.status === "scheduled");
  const groups = [
    // Просроченные идут первыми: день прошёл, а визит не закрыт ни отчётом, ни
    // пропуском — раньше такие визиты просто исчезали из расписания.
    {
      title: "Overdue",
      hint: "The day has passed and the visit isn't closed",
      items: visits.filter((visit) => isOverdue(visit, now)),
    },
    {
      title: "Awaiting a report",
      hint: "Checked in, report not filed yet",
      items: visits.filter(isAwaitingReport),
    },
    { title: "Today", items: upcoming.filter((visit) => visit.date === currentDate) },
    {
      title: "Week ahead",
      items: upcoming.filter((visit) => visit.date > currentDate && visit.date <= weekEnd),
    },
    { title: "Later", items: upcoming.filter((visit) => visit.date > weekEnd) },
    { title: "Report filed", items: visits.filter((visit) => visit.status === "completed") },
    {
      title: "Missed",
      hint: "No earnings from these",
      items: visits.filter((visit) => visit.status === "missed"),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <section>
      {visits.length === 0 ? (
        <EmptyState>No visits yet. They appear once you accept a booking.</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.title}>
              <Eyebrow>
                {group.title} · {group.items.length}
                {group.hint && <span className="ml-2 normal-case">{group.hint}</span>}
              </Eyebrow>
              <div className="flex flex-col gap-3">
                {group.items.map((visit) => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    state={state}
                    focused={visit.id === focusVisitId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function VisitCard({
  visit,
  state,
  focused,
}: {
  visit: Visit;
  state: DomainState;
  focused: boolean;
}) {
  const { dispatch, now } = useStore();
  const [missedReason, setMissedReason] = useState("");
  const card = useRef<HTMLDivElement>(null);

  // Рамка сбрасывает прокрутку на новом экране и делает это после эффектов
  // потомков; кадром позже карточка забирает прокрутку себе. Переход «из
  // брони в работу» должен закончиться на визите, а не рядом с ним.
  useEffect(() => {
    if (!focused) return;
    const frame = requestAnimationFrame(() => {
      if (card.current) scrollIntoScreen(card.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [focused]);
  const booking = state.bookings[visit.bookingId];
  const pet = state.pets[booking.petId];
  const family = state.families[booking.familyId];
  const report = state.reports[visit.id];
  const completed = visit.status === "completed";
  const missed = visit.status === "missed";

  return (
    <Card ref={card} focused={focused}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-title text-stone-900">
            {formatDateWithWeekday(visit.date)} · {slotLabel(visit.slot)}
          </p>
          <p className="mt-0.5 text-meta text-stone-500">
            {pet.name} · {family.name}, {family.address}
          </p>
          {/* Визит принадлежит броне, а условия работы обсуждаются там: из
              карточки должен быть переход, а не поиск по списку. */}
          <a
            href={routeToHash({ role: "sitter", screen: "booking", bookingId: booking.id })}
            className="mt-1.5 inline-flex text-meta text-stone-500 underline underline-offset-2 transition hover:text-stone-900"
          >
            Booking {formatDateRange(booking.startDate, booking.endDate)}{" "}
            <span aria-hidden="true" className="ml-0.5">→</span>
          </a>
        </div>
        {visit.checkedInAt && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-meta font-medium text-emerald-900">
            On site since {formatTime(visit.checkedInAt)}
          </span>
        )}
      </div>

      {!completed && !missed && (
        <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2.5 text-meta text-stone-700">
          <span className="font-medium">Care: </span>
          {pet.careNotes}
        </p>
      )}

      {missed && (
        <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2.5 text-meta text-orange-900">
          Visit missed{visit.missedReason && `: “${visit.missedReason}”`}. No earnings from it, and
          the family sees this in their feed.
        </p>
      )}

      {visit.status === "scheduled" && (
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <GuardedButton
            guard={canCheckIn(state, visit.id, now)}
            onClick={() => dispatch({ type: "VisitCheckedIn", visitId: visit.id })}
          >
            Check in
          </GuardedButton>
          <MissedAction visit={visit} state={state} reason={missedReason} onReason={setMissedReason} />
        </div>
      )}

      {visit.status === "checkedIn" && (
        <>
          <ReportComposer visit={visit} state={state} />
          {/* Ошибочно отмеченный приход надо чем-то закрыть, иначе бронь не сдать. */}
          <div className="mt-3 flex flex-wrap items-start gap-3 border-t border-stone-200 pt-3">
            <MissedAction
              visit={visit}
              state={state}
              reason={missedReason}
              onReason={setMissedReason}
            />
          </div>
        </>
      )}

      {completed && report && (
        <p className="mt-3 text-meta text-stone-600">
          Report sent: {report.tasks.map(careTaskLabel).join(", ") || "no tasks"}
          {report.photos.length > 0 && `, ${plural(report.photos.length, "photo")}`}.
          {report.readByFamilyAt ? " The family read it." : " The family hasn't read it yet."}
        </p>
      )}
    </Card>
  );
}

/** Отметка пропуска: причину видит семья, поэтому она не обязательна, но полезна. */
function MissedAction({
  visit,
  state,
  reason,
  onReason,
}: {
  visit: Visit;
  state: DomainState;
  reason: string;
  onReason: (value: string) => void;
}) {
  const { dispatch } = useStore();

  return (
    <>
      <input
        type="text"
        value={reason}
        placeholder="Why it didn't happen"
        onChange={(event) => onReason(event.target.value)}
        className={`${inputClass} min-w-48 flex-1`}
      />
      <GuardedButton
        tone="danger"
        guard={canMarkVisitMissed(state, visit.id)}
        onClick={() =>
          dispatch({
            type: "VisitMissed",
            visitId: visit.id,
            reason: reason.trim() || undefined,
          })
        }
      >
        Mark as missed
      </GuardedButton>
    </>
  );
}
