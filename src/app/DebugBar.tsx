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
          Prototype time: <span className="text-stone-700">{formatDateTime(now)}</span>
          {offsetHours !== 0 && ` (shifted +${formatDuration(offsetHours * 3_600_000)})`}
        </span>
        <DebugButton onClick={() => advanceHours(1)}>+1 hour</DebugButton>
        <DebugButton onClick={() => advanceHours(24)}>+24 hours</DebugButton>
        <DebugButton onClick={() => setShowJournal((open) => !open)}>
          {showJournal ? "Hide event log" : `Event log · ${state.journal.length}`}
        </DebugButton>
        <DebugButton onClick={reset}>Reset to seed data</DebugButton>
      </div>

      {showJournal && (
        <ol className="flex flex-col gap-1 rounded-md border border-stone-200 bg-white p-3">
          {state.journal.length === 0 && <li className="text-stone-400">No events yet.</li>}
          {state.journal.map((entry, index) => (
            <li key={index} className="flex flex-wrap gap-x-2">
              <span className="tabular-nums text-stone-400">{formatDateTime(entry.at)}</span>
              <span className={entry.rejection ? "text-red-700" : "text-stone-700"}>
                {eventLabel(entry.event)}
              </span>
              {entry.rejection && <span className="text-red-600">rejected: {entry.rejection}</span>}
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
