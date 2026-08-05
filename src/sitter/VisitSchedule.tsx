import { addDays, today } from "../domain/dates";
import { canCheckIn } from "../domain/guards";
import { SEED_SITTER_ID } from "../domain/seed";
import type { DomainState, Visit } from "../domain/types";
import { compareVisits } from "../domain/visits";
import { useStore } from "../store/StoreProvider";
import { formatDateWithWeekday, formatTime, slotLabel } from "../app/format";
import { Card, EmptyState, GuardedButton, SectionTitle } from "../app/ui";

/**
 * Расписание ситтера: сегодня, неделя вперёд, позже. Отметка прихода
 * заблокирована, пока передача ключей не подтверждена обеими сторонами —
 * чтобы ситтер не приехал к закрытой двери.
 */
export function VisitSchedule() {
  const { state, now } = useStore();
  const currentDate = today(now);
  const weekEnd = addDays(currentDate, 7);

  const visits = Object.values(state.visits)
    .filter((visit) => visit.status !== "cancelled")
    .filter((visit) => state.bookings[visit.bookingId].sitterId === SEED_SITTER_ID)
    .sort(compareVisits);

  const groups = [
    { title: "Сегодня", items: visits.filter((visit) => visit.date === currentDate) },
    {
      title: "Неделя вперёд",
      items: visits.filter((visit) => visit.date > currentDate && visit.date <= weekEnd),
    },
    { title: "Позже", items: visits.filter((visit) => visit.date > weekEnd) },
  ].filter((group) => group.items.length > 0);

  return (
    <section>
      <SectionTitle hint="Инструкции по питомцу — в карточке визита, искать в переписке не нужно">
        Расписание визитов
      </SectionTitle>
      {visits.length === 0 ? (
        <EmptyState>Визитов нет. Они появятся, когда вы примете бронь.</EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-xs font-medium tracking-wide text-stone-400 uppercase">
                {group.title}
              </p>
              <div className="flex flex-col gap-3">
                {group.items.map((visit) => (
                  <VisitCard key={visit.id} visit={visit} state={state} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function VisitCard({ visit, state }: { visit: Visit; state: DomainState }) {
  const { dispatch, now } = useStore();
  const booking = state.bookings[visit.bookingId];
  const pet = state.pets[booking.petId];
  const family = state.families[booking.familyId];
  const checkedIn = visit.status === "checkedIn";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">
            {formatDateWithWeekday(visit.date)} · {slotLabel(visit.slot)}
          </p>
          <p className="text-sm text-stone-500">
            {pet.name} · {family.name}, {family.address}
          </p>
        </div>
        {checkedIn && visit.checkedInAt && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900">
            На месте с {formatTime(visit.checkedInAt)}
          </span>
        )}
      </div>

      <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
        <span className="font-medium">Уход: </span>
        {pet.careNotes}
      </p>

      {!checkedIn && (
        <div className="mt-3">
          <GuardedButton
            guard={canCheckIn(state, visit.id, now)}
            onClick={() => dispatch({ type: "VisitCheckedIn", visitId: visit.id })}
          >
            Отметить приход
          </GuardedButton>
        </div>
      )}
    </Card>
  );
}
