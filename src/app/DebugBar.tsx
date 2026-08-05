import { useStore } from "../store/StoreProvider";

/**
 * Управление прототипом. Пока только сброс к сид-данным;
 * прокрутка времени и журнал событий появятся в тикете 10.
 */
export function DebugBar() {
  const { reset, state } = useStore();

  return (
    <div className="flex items-center gap-3 text-xs text-stone-500">
      <span>событий: {state.journal.length}</span>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-stone-300 bg-white px-2.5 py-1 font-medium text-stone-700 transition hover:bg-stone-50"
      >
        Сбросить к сид-данным
      </button>
    </div>
  );
}
