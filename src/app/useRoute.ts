import { useEffect, useState } from "react";
import { parseRoute } from "./routes";
import type { Route } from "./routes";

/**
 * Адрес — единственный источник правды об экране. Отсюда бесплатно берутся
 * кнопки «назад» и «вперёд», прямые ссылки и переживание перезагрузки.
 */
export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return parseRoute(hash);
}
