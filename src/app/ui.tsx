import type { ReactNode } from "react";
import type { Guard } from "../domain/guards";

/** Кнопка действия, управляемая guard'ом домена: причина отказа видна пользователю. */
export function GuardedButton({
  guard,
  onClick,
  children,
  tone = "primary",
}: {
  guard: Guard;
  onClick: () => void;
  children: ReactNode;
  tone?: "primary" | "neutral" | "danger";
}) {
  // enabled:hover — иначе наведение подсвечивает и заблокированную кнопку,
  // и она перестаёт выглядеть заблокированной.
  const tones = {
    primary: "bg-stone-900 text-white enabled:hover:bg-stone-700",
    neutral: "bg-white text-stone-900 border border-stone-300 enabled:hover:bg-stone-50",
    danger: "bg-white text-red-700 border border-red-300 enabled:hover:bg-red-50",
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={!guard.allowed}
        onClick={onClick}
        title={guard.allowed ? undefined : guard.reason}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-200 disabled:text-stone-400 ${tones[tone]}`}
      >
        {children}
      </button>
      {!guard.allowed && <span className="text-xs text-stone-500">{guard.reason}</span>}
    </span>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">{children}</div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold text-stone-900">{children}</h2>
      {hint && <p className="mt-0.5 text-sm text-stone-500">{hint}</p>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-stone-500";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
      {children}
    </p>
  );
}
