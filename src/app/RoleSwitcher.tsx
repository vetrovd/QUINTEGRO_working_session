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
    // Переключатель ролей — не действие продукта, а способ смотреть на него с
    // двух сторон, поэтому он остаётся нейтральным: акцент занят главным
    // действием экрана и активным разделом.
    <div className="flex items-center gap-0.5 rounded-lg bg-stone-100 p-0.5">
      {(["family", "sitter"] as const).map((item) => (
        // Ссылка, а не кнопка: переключение роли — такой же переход, как
        // любой другой, и должно попадать в историю браузера.
        <a
          key={item}
          href={routeToHash(homeOf(item))}
          className={`rounded-[0.3rem] px-2.5 py-1 text-meta font-medium transition ${
            role === item
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-900"
          }`}
        >
          {item === "family" ? "Family" : "Sitter"}
          <span className="ml-1 text-stone-400">{names[item]}</span>
        </a>
      ))}
    </div>
  );
}
