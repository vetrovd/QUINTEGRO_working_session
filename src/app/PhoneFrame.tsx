import { useEffect, useRef } from "react";
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
  screenKey,
  children,
}: {
  header: ReactNode;
  nav?: ReactNode;
  /** Меняется вместе с экраном: новый экран открывается с начала. */
  screenKey: string;
  children: ReactNode;
}) {
  const body = useRef<HTMLElement>(null);

  // Прокрутка принадлежит экрану, а не рамке: без сброса переход по ссылке
  // приводит в середину нового экрана, и связь между разделами выглядит
  // сломанной ровно там, где она и должна работать.
  useEffect(() => {
    body.current?.scrollTo(0, 0);
  }, [screenKey]);

  return (
    <div className="flex w-full max-w-[400px] flex-col overflow-hidden rounded-[2.25rem] border-stone-900 bg-paper shadow-[0_24px_60px_-24px_rgba(41,32,26,0.45)] sm:h-[min(820px,calc(100vh-4rem))] sm:border-[10px]">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200/80 bg-white px-5 py-3.5">
        {header}
      </header>

      <main data-screen-body className="flex-1 overflow-y-auto px-5 py-5" ref={body}>
        {children}
      </main>

      {nav && <nav className="border-t border-stone-200/80 bg-white">{nav}</nav>}
    </div>
  );
}

/**
 * Подвести элемент к началу экрана. Не `scrollIntoView`: тот прокручивает и
 * страницу вокруг рамки, а рамка — граница продукта, и она не должна ездить
 * от того, что происходит внутри.
 */
export function scrollIntoScreen(element: HTMLElement): void {
  const body = element.closest("[data-screen-body]");
  if (!(body instanceof HTMLElement)) return;
  const offset = element.getBoundingClientRect().top - body.getBoundingClientRect().top;
  body.scrollTo({ top: body.scrollTop + offset - 16 });
}
