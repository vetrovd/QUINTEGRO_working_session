import { canMarkReportRead } from "../domain/guards";
import { submittedReportsOfBooking, unreadReportsCount } from "../domain/reports";
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
  const hasReports = bookings.some(
    (booking) => submittedReportsOfBooking(state, booking.id).length > 0,
  );

  return (
    <section>
      <SectionTitle hint="Прочтение отчёта ни к чему вас не обязывает и не влияет на оплату">
        Отчёты о визитах{unread > 0 && ` · ${unread} новых`}
      </SectionTitle>

      {!hasReports ? (
        <EmptyState>Отчётов пока нет. Они появятся, когда ситтер начнёт визиты.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {bookings.flatMap((booking) =>
            submittedReportsOfBooking(state, booking.id).map(({ visit }) => (
              <ReportCard key={visit.id} state={state} visitId={visit.id} />
            )),
          )}
        </div>
      )}
    </section>
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
            {pet.name} · отчёт сдан {report.submittedAt && formatDateTime(report.submittedAt)}
          </p>
        </div>
        {unread && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
            Новое
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
              alt={`${pet.name}, фото ${index + 1}`}
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
            Отметить прочитанным
          </GuardedButton>
        ) : (
          <p className="text-xs text-stone-500">
            Прочитано {report.readByFamilyAt && formatDateTime(report.readByFamilyAt)}
          </p>
        )}
      </div>
    </Card>
  );
}
