import { useState } from "react";
import { canSaveVisitReport, canSubmitVisitReport } from "../domain/guards";
import type { CareTask, DomainState, Visit } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { careTaskLabel, formatDateTime } from "../app/format";
import { MAX_PHOTOS, readPhotoAsDataUrl } from "../app/images";
import { GuardedButton, inputClass } from "../app/ui";

/**
 * Составление отчёта по визиту: чеклист из задач питомца, фото, заметка.
 * Черновик сохраняется отдельно от отправки — отправленный отчёт уже
 * неизменяем, поэтому отправка это осознанное второе действие.
 */
export function ReportComposer({ visit, state }: { visit: Visit; state: DomainState }) {
  const { dispatch } = useStore();
  const booking = state.bookings[visit.bookingId];
  const pet = state.pets[booking.petId];
  const draft = state.reports[visit.id];

  const [tasks, setTasks] = useState<CareTask[]>(draft?.tasks ?? []);
  const [note, setNote] = useState(draft?.note ?? "");
  const [photos, setPhotos] = useState<string[]>(draft?.photos ?? []);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const saveGuard = canSaveVisitReport(state, visit.id);
  const submitGuard = canSubmitVisitReport(state, visit.id);
  const dirty =
    draft === undefined ||
    note !== draft.note ||
    photos.length !== draft.photos.length ||
    tasks.length !== draft.tasks.length ||
    tasks.some((task) => !draft.tasks.includes(task));

  function toggleTask(task: CareTask) {
    setTasks((current) =>
      current.includes(task)
        ? current.filter((item) => item !== task)
        : pet.careTasks.filter((item) => current.includes(item) || item === task),
    );
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setPhotoError(`Не больше ${MAX_PHOTOS} фото на отчёт`);
      return;
    }
    try {
      const added = await Promise.all(
        Array.from(files).slice(0, room).map(readPhotoAsDataUrl),
      );
      setPhotos((current) => [...current, ...added]);
    } catch {
      setPhotoError("Не удалось прочитать файл");
    }
  }

  function save() {
    dispatch({ type: "VisitReportSaved", visitId: visit.id, tasks, note, photos });
  }

  return (
    <div className="mt-3 rounded-lg border border-stone-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-stone-900">Отчёт о визите</h4>
        {draft && (
          <span className="text-xs text-stone-500">
            черновик сохранён {formatDateTime(draft.updatedAt)}
          </span>
        )}
      </div>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-stone-700">Выполнено</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {pet.careTasks.map((task) => (
            <label key={task} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tasks.includes(task)}
                onChange={() => toggleTask(task)}
                className="size-4 accent-stone-900"
              />
              {careTaskLabel(task)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="font-medium text-stone-700">Заметка</span>
        <textarea
          value={note}
          rows={2}
          placeholder="Что стоит знать семье"
          onChange={(event) => setNote(event.target.value)}
          className={inputClass}
        />
      </label>

      <div className="mt-3">
        <p className="text-sm font-medium text-stone-700">Фото</p>
        {photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((photo, index) => (
              <div key={photo.slice(-24)} className="relative">
                <img
                  src={photo}
                  alt={`Фото ${index + 1}`}
                  className="size-20 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, item) => item !== index))}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-stone-900 text-xs text-white"
                  title="Убрать фото"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => void addPhotos(event.target.files)}
          className="mt-2 block text-sm text-stone-600"
        />
        {photoError && <p className="mt-1 text-xs text-red-700">{photoError}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-stone-200 pt-3">
        <GuardedButton tone="neutral" guard={saveGuard} onClick={save}>
          Сохранить черновик
        </GuardedButton>
        <GuardedButton
          guard={dirty ? { allowed: false, reason: "Сначала сохраните черновик" } : submitGuard}
          onClick={() => dispatch({ type: "VisitReportSubmitted", visitId: visit.id })}
        >
          Отправить отчёт
        </GuardedButton>
        <p className="text-xs text-stone-500">Отправленный отчёт изменить нельзя.</p>
      </div>
    </div>
  );
}
