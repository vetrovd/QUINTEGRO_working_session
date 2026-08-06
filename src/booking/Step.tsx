import type { ReactNode } from "react";

export type StepState = "done" | "current" | "future" | "blocked";

/**
 * Шаг таймлайна. Пройденный сворачивается в строку-запись, текущий раскрыт с
 * элементами управления, будущий остаётся видимым с причиной блокировки.
 *
 * Свернуть можно, скрыть нельзя: видимость недоступного действия — то
 * единственное, ради чего прототип строился. Поэтому у `future` причина
 * печатается всегда, а не прячется под наведение.
 */
export function Step({
  title,
  state,
  record,
  reason,
  last = false,
  children,
}: {
  title: string;
  state: StepState;
  /** Строка-запись пройденного шага: что произошло и когда. */
  record?: ReactNode;
  /** Почему шаг недоступен — текст приходит из guard'а домена. */
  reason?: string;
  last?: boolean;
  children?: ReactNode;
}) {
  // Цвета состояний не трогает ни один визуальный проход: по ним читается,
  // где бронь стоит и почему не идёт дальше. Акцент подобран так, чтобы с
  // ними не спорить, а не наоборот.
  const marker = {
    done: { tone: "bg-emerald-100 text-emerald-900", glyph: "✓" },
    current: { tone: "bg-amber-100 text-amber-900 ring-2 ring-amber-300", glyph: "•" },
    future: { tone: "bg-stone-100 text-stone-400", glyph: "•" },
    blocked: { tone: "bg-red-100 text-red-900", glyph: "!" },
  }[state];

  return (
    <li className="flex gap-3.5">
      <div className="flex flex-col items-center">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-meta font-semibold ${marker.tone}`}
        >
          {marker.glyph}
        </span>
        {!last && <span className="mt-1.5 w-px flex-1 bg-stone-200" />}
      </div>

      <div className={`min-w-0 flex-1 ${last ? "" : "pb-6"}`}>
        <h3
          className={`text-body font-semibold ${
            state === "future" ? "text-stone-400" : "text-stone-900"
          }`}
        >
          {title}
        </h3>
        {record && <p className="mt-1 text-meta text-stone-500">{record}</p>}
        {reason && state !== "current" && <p className="mt-1 text-meta text-stone-400">{reason}</p>}
        {children && <div className="mt-3 flex flex-col gap-3 text-body">{children}</div>}
      </div>
    </li>
  );
}

export function StepNote({ children }: { children: ReactNode }) {
  return <p className="text-body text-stone-600">{children}</p>;
}
