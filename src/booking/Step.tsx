import type { ReactNode } from "react";

/** Один шаг согласования. Одинаково выглядит у семьи и у ситтера. */
export function Step({
  title,
  state,
  children,
}: {
  title: string;
  state: "done" | "waiting" | "todo" | "blocked";
  children: ReactNode;
}) {
  const marker = {
    done: { tone: "bg-emerald-100 text-emerald-900", glyph: "✓" },
    waiting: { tone: "bg-amber-100 text-amber-900", glyph: "•" },
    todo: { tone: "bg-stone-200 text-stone-500", glyph: "•" },
    /** Тупик: дальше в прототипе хода нет. */
    blocked: { tone: "bg-red-100 text-red-900", glyph: "!" },
  }[state];

  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <div className="flex items-center gap-2">
        <span
          className={`flex size-5 items-center justify-center rounded-full text-xs font-semibold ${marker.tone}`}
        >
          {marker.glyph}
        </span>
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      </div>
      <div className="mt-2 flex flex-col gap-3 pl-7 text-sm">{children}</div>
    </div>
  );
}

export function StepNote({ children }: { children: ReactNode }) {
  return <p className="text-stone-600">{children}</p>;
}
