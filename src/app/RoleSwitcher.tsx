import { useStore } from "../store/StoreProvider";
import type { Role } from "../domain/types";
import { SEED_FAMILY_ID, SEED_SITTER_ID } from "../domain/seed";
import { homeOf, routeToHash } from "./routes";

/** Обе роли работают на общих данных: действие одной сразу видно другой. */
export function RoleSwitcher({ role }: { role: Role }) {
  const { state } = useStore();
  const names: Record<Role, string> = {
    family: state.families[SEED_FAMILY_ID].name,
    sitter: state.sitters[SEED_SITTER_ID].name.split(" ")[0],
  };

  return (
    <div className="flex items-center gap-1 rounded-lg bg-stone-200 p-0.5">
      {(["family", "sitter"] as const).map((item) => (
        // Ссылка, а не кнопка: переключение роли — такой же переход, как
        // любой другой, и должно попадать в историю браузера.
        <a
          key={item}
          href={routeToHash(homeOf(item))}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            role === item
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          {item === "family" ? "Family" : "Sitter"}
          <span className="ml-1 text-stone-400">{names[item]}</span>
        </a>
      ))}
    </div>
  );
}
