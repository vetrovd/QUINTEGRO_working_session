import { useStore } from "../store/StoreProvider";
import type { Role } from "../domain/types";

const ROLES: { role: Role; label: string }[] = [
  { role: "family", label: "Family" },
  { role: "sitter", label: "Sitter" },
];

/** Обе роли работают на общих данных: действие одной сразу видно другой. */
export function RoleSwitcher() {
  const { role, setRole, state } = useStore();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-stone-200 p-1">
      {ROLES.map((item) => (
        <button
          key={item.role}
          type="button"
          onClick={() => setRole(item.role)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            role === item.role
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          {item.label}
          <span className="ml-1.5 text-xs text-stone-400">
            {item.role === "family"
              ? state.families["family-1"].name
              : state.sitters["sitter-1"].name.split(" ")[0]}
          </span>
        </button>
      ))}
    </div>
  );
}
