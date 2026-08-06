import type { ReactNode } from "react";

/**
 * Узкая колонка, на широком экране — в рамке телефона. Рамка тут не украшение:
 * в неё физически не помещается всё сразу, и это ровно то ограничение, ради
 * которого редизайн затевался. Прокручивается только содержимое — шапка и
 * нижнее меню остаются на месте, как в настоящем приложении.
 */
export function PhoneFrame({
  header,
  nav,
  children,
}: {
  header: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[400px] flex-col overflow-hidden rounded-[2rem] border-stone-900 bg-white shadow-xl sm:h-[min(820px,calc(100vh-4rem))] sm:border-[10px]">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        {header}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">{children}</main>

      {nav && <nav className="border-t border-stone-200 bg-white">{nav}</nav>}
    </div>
  );
}
