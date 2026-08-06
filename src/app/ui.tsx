import type { ReactNode, Ref } from "react";
import type { Guard } from "../domain/guards";
import type { BookingStatus } from "../domain/types";
import { statusText, statusTone } from "./format";

/**
 * Общие элементы интерфейса. Карточка, строка списка и пустое состояние
 * заданы здесь по одному разу: на экранах остаётся содержимое, а не повторение
 * оформления, и «единообразно» держится само собой, а не дисциплиной.
 */

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
    primary: "bg-accent text-white enabled:hover:bg-accent-strong",
    neutral: "bg-white text-stone-900 border border-stone-300 enabled:hover:bg-stone-50",
    danger: "bg-white text-red-700 border border-red-300 enabled:hover:bg-red-50",
  };

  return (
    <span className="inline-flex flex-col gap-1.5">
      <button
        type="button"
        disabled={!guard.allowed}
        onClick={onClick}
        title={guard.allowed ? undefined : guard.reason}
        className={`rounded-lg px-3.5 py-2 text-body font-medium transition disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-200 disabled:text-stone-400 ${tones[tone]}`}
      >
        {children}
      </button>
      {!guard.allowed && <span className="text-meta text-stone-500">{guard.reason}</span>}
    </span>
  );
}

export function Card({
  children,
  ref,
  focused = false,
}: {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
  /** Карточка, ради которой сюда пришли по ссылке: её видно среди прочих. */
  focused?: boolean;
}) {
  return (
    <div
      ref={ref}
      className={`rounded-xl border bg-white p-4 ${
        focused ? "border-stone-400 ring-1 ring-stone-300" : "border-stone-200"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Строка списка. Всегда ссылка: список — это способ выбрать одну запись, и
 * нажимается вся строка, а не заголовок внутри неё.
 */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-300 hover:bg-stone-50"
    >
      {children}
    </a>
  );
}

/** Статус брони — одна и та же метка в списке и в шапке экрана. */
export function StatusChip({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-meta font-medium ${statusTone(status)}`}
    >
      {statusText(status)}
    </span>
  );
}

/** Надзаголовок группы: что это за пачка строк и сколько их в ней. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-eyebrow text-stone-400 uppercase">{children}</p>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-title text-stone-900">{children}</h2>
      {hint && <p className="mt-1 text-meta text-stone-500">{hint}</p>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-body">
      <span className="font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-body outline-none transition focus:border-stone-500";

/** Пустое состояние — приглашение к действию, а не сообщение об отсутствии. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-stone-300 bg-white/60 px-5 py-8 text-center text-body text-stone-500">
      {children}
    </p>
  );
}

/** Заголовок экрана с возвратом на уровень выше. */
export function ScreenTitle({
  children,
  back,
  hint,
}: {
  children: ReactNode;
  back?: { href: string; label: string };
  hint?: string;
}) {
  return (
    <div className="mb-5">
      {back && (
        <a
          href={back.href}
          className="mb-1.5 inline-flex items-center gap-1 text-meta text-stone-500 transition hover:text-stone-900"
        >
          <span aria-hidden="true">←</span> {back.label}
        </a>
      )}
      <h1 className="text-display text-stone-900">{children}</h1>
      {hint && <p className="mt-1 text-meta text-stone-500">{hint}</p>}
    </div>
  );
}
