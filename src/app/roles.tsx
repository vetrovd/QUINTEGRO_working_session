import { useStore } from "../store/StoreProvider";
import type { DomainState, Role } from "../domain/types";
import { SEED_FAMILY_ID, SEED_SITTER_ID } from "../domain/seed";
import { homeOf, routeToHash } from "./routes";

const ROLES: Role[] = ["family", "sitter"];

const ROLE_TITLES: Record<Role, string> = {
  family: "Family",
  sitter: "Sitter",
};

/** Кто стоит за ролью в сид-данных: одна семья и один ситтер. */
function accountName(state: DomainState, role: Role): string {
  return role === "family"
    ? state.families[SEED_FAMILY_ID].name
    : state.sitters[SEED_SITTER_ID].name;
}

/**
 * Переключатель ролей живёт в панели прототипа, а не в шапке приложения:
 * стать другим человеком — это не действие продукта. Внутри рамки такая
 * кнопка обещала бы то, чего в настоящем приложении не бывает; снаружи она
 * честно читается как инструмент, которым мы прототип рассматриваем.
 *
 * Обе роли работают на общих данных: действие одной сразу видно другой.
 */
export function RoleSwitcher({ role }: { role: Role }) {
  const { state } = useStore();

  return (
    <div>
      <p className="mb-2 text-eyebrow text-stone-500 uppercase">Viewing as</p>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((item) => {
          const active = role === item;
          return (
            // Ссылка, а не кнопка: переключение роли — такой же переход, как
            // любой другой, и должно попадать в историю браузера.
            <a
              key={item}
              href={routeToHash(homeOf(item))}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col gap-0.5 border px-2.5 py-1.5 text-meta transition ${
                active
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
              }`}
            >
              <span className="font-medium">{ROLE_TITLES[item]}</span>
              <span className={active ? "text-stone-400" : "text-stone-500"}>
                {accountName(state, item)}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Кто открыл приложение — в шапке продукта. Переключатель отсюда ушёл, но
 * ответ на вопрос «чей это экран» нужен на каждом скриншоте: половина смысла
 * прототипа в том, что одно и то же событие обе стороны видят по-разному.
 */
export function AccountName({ role }: { role: Role }) {
  const { state } = useStore();

  return <p className="text-meta text-stone-500">{accountName(state, role)}</p>;
}
