import { canMarkReportRead } from "../domain/guards";
import { visitTimelineOfBooking } from "../domain/reports";
import type { BookingId, DomainState, Role, VisitId } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { careTaskLabel, formatDateTime, formatDateWithWeekday, slotLabel } from "../app/format";
import { GuardedButton } from "../app/ui";

/**
 * Визиты брони по времени: и состоявшиеся, и пропущенные. Семья читает, но не
 * акцептует — кнопки «принять отчёт» здесь нет, прочтение не двигает деньги
 * (ADR 0001). Фото показано крупно: для семьи в отъезде это главное в отчёте.
 */
export function VisitFeed({ bookingId, role }: { bookingId: BookingId; role: Role }) {
  const { state } = useStore();
  const timeline = visitTimelineOfBooking(state, bookingId);

  if (timeline.length === 0) {
    return <p className="text-body text-stone-500">No visits reported yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {timeline.map((visit) =>
        visit.status === "missed" ? (
          <MissedEntry key={visit.id} state={state} visitId={visit.id} />
        ) : (
          <ReportEntry key={visit.id} state={state} visitId={visit.id} role={role} />
        ),
      )}
    </ol>
  );
}

/**
 * Фото — не приложение к отчёту, а сам отчёт: семья в отъезде смотрит сюда
 * первым делом. Поэтому оно занимает карточку целиком, а текст идёт под ним
 * подписью. Первое фото всегда крупное: одно хорошее фото важнее ровной сетки.
 */
function ReportPhotos({ photos, petName }: { photos: string[]; petName: string }) {
  if (photos.length === 0) return null;
  const [lead, ...rest] = photos;

  return (
    <div className="flex flex-col gap-1 bg-stone-100">
      <img
        src={lead}
        alt={`${petName}, photo 1`}
        className="aspect-[4/3] w-full object-cover"
      />
      {rest.length > 0 && (
        // Полоса подстраивается под число оставшихся фото: пустая ячейка в
        // сетке читается как «фото не загрузилось».
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.min(rest.length, 3)}, minmax(0, 1fr))` }}
        >
          {rest.map((photo, index) => (
            <img
              key={photo.slice(-24)}
              src={photo}
              alt={`${petName}, photo ${index + 2}`}
              className="aspect-square w-full object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryHead({ title, note, badge }: { title: string; note: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-body font-semibold text-stone-900">{title}</p>
        <p className="text-meta text-stone-500">{note}</p>
      </div>
      {badge && (
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-meta font-medium text-amber-900">
          {badge}
        </span>
      )}
    </div>
  );
}

/** Пропущенный визит стоит в ленте наравне с состоявшимся, а не прячется. */
function MissedEntry({ state, visitId }: { state: DomainState; visitId: VisitId }) {
  const visit = state.visits[visitId];

  return (
    <li className="rounded-xl border border-orange-200 bg-orange-50 p-4">
      <EntryHead
        title={`${formatDateWithWeekday(visit.date)} · ${slotLabel(visit.slot)}`}
        note={visit.missedAt ? `Marked ${formatDateTime(visit.missedAt)}` : ""}
        badge="Missed"
      />
      <p className="mt-2 text-body text-orange-900">
        {visit.missedReason ? `"${visit.missedReason}". ` : ""}This visit won't be paid for.
      </p>
    </li>
  );
}

function ReportEntry({
  state,
  visitId,
  role,
}: {
  state: DomainState;
  visitId: VisitId;
  role: Role;
}) {
  const { dispatch } = useStore();
  const visit = state.visits[visitId];
  const report = state.reports[visitId];
  const pet = state.pets[state.bookings[visit.bookingId].petId];
  const unread = !report.readByFamilyAt;

  return (
    <li className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <ReportPhotos photos={report.photos} petName={pet.name} />

      <div className="p-4">
        <EntryHead
          title={`${formatDateWithWeekday(visit.date)} · ${slotLabel(visit.slot)}`}
          note={report.submittedAt ? `Filed ${formatDateTime(report.submittedAt)}` : ""}
          badge={unread && role === "family" ? "New" : undefined}
        />

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {pet.careTasks.map((task) => {
            const done = report.tasks.includes(task);
            return (
              <li
                key={task}
                className={`rounded-md px-2 py-0.5 text-meta ${
                  done
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-stone-100 text-stone-400 line-through"
                }`}
              >
                {done ? "✓ " : ""}
                {careTaskLabel(task)}
              </li>
            );
          })}
        </ul>

        {report.note.trim() && <p className="mt-3 text-body text-stone-700">{report.note}</p>}

        {role === "family" && (
          <div className="mt-3">
            {unread ? (
              <GuardedButton
                tone="neutral"
                guard={canMarkReportRead(state, visitId)}
                onClick={() => dispatch({ type: "VisitReportRead", visitId })}
              >
                Mark as read
              </GuardedButton>
            ) : (
              <p className="text-meta text-stone-400">
                Read {report.readByFamilyAt && formatDateTime(report.readByFamilyAt)}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
