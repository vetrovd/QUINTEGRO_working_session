import { useState } from "react";
import { useStore } from "../store/StoreProvider";
import { eventLabel, formatDateTime, formatDuration } from "./format";

/**
 * Управление прототипом. Прокрутка времени нужна не для удобства: 48-часовое
 * окно подтверждения (ADR 0001) иначе нечем показать. Журнал отвечает на
 * вопрос «почему система в таком состоянии» — включая отклонённые события.
 */
export function DebugBar() {
  const { reset, state, now, advanceHours, offsetHours } = useStore();
  const [showJournal, setShowJournal] = useState(false);

  return (
    <div className="flex flex-col gap-3 text-xs text-stone-500">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span>
          Время прототипа: <span className="text-stone-700">{formatDateTime(now)}</span>
          {offsetHours !== 0 && ` (сдвиг +${formatDuration(offsetHours * 3_600_000)})`}
        </span>
        <DebugButton onClick={() => advanceHours(1)}>+1 час</DebugButton>
        <DebugButton onClick={() => advanceHours(24)}>+24 часа</DebugButton>
        <DebugButton onClick={() => setShowJournal((open) => !open)}>
          {showJournal ? "Скрыть журнал" : `Журнал событий · ${state.journal.length}`}
        </DebugButton>
        <DebugButton onClick={reset}>Сбросить к сид-данным</DebugButton>
      </div>

      {showJournal && (
        <ol className="flex flex-col gap-1 rounded-md border border-stone-200 bg-white p-3">
          {state.journal.length === 0 && <li className="text-stone-400">Событий пока нет.</li>}
          {state.journal.map((entry, index) => (
            <li key={index} className="flex flex-wrap gap-x-2">
              <span className="tabular-nums text-stone-400">{formatDateTime(entry.at)}</span>
              <span className={entry.rejection ? "text-red-700" : "text-stone-700"}>
                {eventLabel(entry.event)}
              </span>
              {entry.rejection && <span className="text-red-600">отклонено: {entry.rejection}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DebugButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-stone-300 bg-white px-2.5 py-1 font-medium text-stone-700 transition hover:bg-stone-50"
    >
      {children}
    </button>
  );
}
