import { FamilyView } from "../family/FamilyView";
import { SitterView } from "../sitter/SitterView";
import { useStore } from "../store/StoreProvider";
import { DebugBar } from "./DebugBar";
import { RoleSwitcher } from "./RoleSwitcher";

export function App() {
  const { role } = useStore();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Pet sitting</h1>
          <p className="text-sm text-stone-500">
            Prototype: {role === "family" ? "family view" : "sitter view"}
          </p>
        </div>
        <RoleSwitcher />
      </header>

      <main>{role === "family" ? <FamilyView /> : <SitterView />}</main>

      <footer className="mt-auto border-t border-stone-200 pt-4">
        <DebugBar />
      </footer>
    </div>
  );
}
