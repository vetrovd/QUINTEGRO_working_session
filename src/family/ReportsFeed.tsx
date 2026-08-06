import { canMarkReportRead } from "../domain/guards";
import { unreadReportsCount, visitTimelineOfBooking } from "../domain/reports";
import { SEED_FAMILY_ID } from "../domain/seed";
import type { DomainState } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { careTaskLabel, formatDateTime, formatDateWithWeekday, slotLabel } from "../app/format";
import { Card, EmptyState, GuardedButton, SectionTitle } from "../app/ui";

/**
 * Лента отчётов. Семья читает, но не акцептует: кнопки «принять отчёт» здесь
 * нет — прочтение не двигает деньги (ADR 0001).
 */
export function ReportsFeed() {
  const { state } = useStore();
  const bookings = Object.values(state.bookings)
    .filter((booking) => booking.familyId === SEED_FAMILY_ID)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const unread = bookings.reduce(
    (total, booking) => total + unreadReportsCount(state, booking.id),
    0,
  );
  const timeline = bookings.flatMap((booking) => visitTimelineOfBooking(state, booking.id));

  return (
    <section>
      <SectionTitle hint="Reading a report commits you to nothing and doesn’t affect payment">
        Visit reports{unread > 0 && ` · ${unread} new`}
      </SectionTitle>

      {timeline.length === 0 ? (
        <EmptyState>No reports yet. They’ll show up once the sitter starts visiting.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {timeline.map((visit) =>
            visit.status === "missed" ? (
              <MissedCard key={visit.id} state={state} visitId={visit.id} />
            ) : (
              <ReportCard key={visit.id} state={state} visitId={visit.id} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

/** Пропущенный визит в ленте: семья узнаёт о нём сразу, а не при закрытии брони. */
function MissedCard({ state, visitId }: { state: DomainState; visitId: string }) {
  const visit = state.visits[visitId];
  const pet = state.pets[state.bookings[visit.bookingId].petId];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">
            {formatDateWithWeekday(visit.date)} · {slotLabel(visit.slot)}
          </p>
          <p className="text-sm text-stone-500">
            {pet.name} · marked {visit.missedAt && formatDateTime(visit.missedAt)}
          </p>
        </div>
        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-900">
          Missed
        </span>
      </div>

      <p className="mt-3 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-900">
        The sitter marked this visit as missed
        {visit.missedReason && `: “${visit.missedReason}”`}. It won’t be paid for.
      </p>
    </Card>
  );
}

function ReportCard({ state, visitId }: { state: DomainState; visitId: string }) {
  const { dispatch } = useStore();
  const visit = state.visits[visitId];
  const report = state.reports[visitId];
  const pet = state.pets[state.bookings[visit.bookingId].petId];
  const unread = !report.readByFamilyAt;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">
            {formatDateWithWeekday(visit.date)} · {slotLabel(visit.slot)}
          </p>
          <p className="text-sm text-stone-500">
            {pet.name} · report filed {report.submittedAt && formatDateTime(report.submittedAt)}
          </p>
        </div>
        {unread && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
            New
          </span>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {pet.careTasks.map((task) => {
          const done = report.tasks.includes(task);
          return (
            <li
              key={task}
              className={`rounded-md px-2.5 py-1 text-sm ${
                done ? "bg-emerald-50 text-emerald-900" : "bg-stone-100 text-stone-500 line-through"
              }`}
            >
              {done ? "✓ " : ""}
              {careTaskLabel(task)}
            </li>
          );
        })}
      </ul>

      {report.note.trim() && (
        <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
          {report.note}
        </p>
      )}

      {report.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {report.photos.map((photo, index) => (
            <img
              key={photo.slice(-24)}
              src={photo}
              alt={`${pet.name}, photo ${index + 1}`}
              className="h-32 rounded-md object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {unread ? (
          <GuardedButton
            tone="neutral"
            guard={canMarkReportRead(state, visitId)}
            onClick={() => dispatch({ type: "VisitReportRead", visitId })}
          >
            Mark as read
          </GuardedButton>
        ) : (
          <p className="text-xs text-stone-500">
            Read {report.readByFamilyAt && formatDateTime(report.readByFamilyAt)}
          </p>
        )}
      </div>
    </Card>
  );
}
