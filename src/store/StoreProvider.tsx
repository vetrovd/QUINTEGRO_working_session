import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { ReactNode } from "react";
import { systemClock } from "../domain/clock";
import { reduce } from "../domain/reducer";
import { createSeedState } from "../domain/seed";
import type { DomainEvent, DomainState, Role } from "../domain/types";

const STORAGE_KEY = "pet-sitting-prototype";
const STORAGE_VERSION = 1;

interface StoreValue {
  state: DomainState;
  dispatch: (event: DomainEvent) => void;
  reset: () => void;
  role: Role;
  setRole: (role: Role) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/**
 * Оборачивает домен: держит состояние, персистит его и подставляет часы.
 * Вся логика переходов остаётся в reduce (ADR 0002) — здесь только доставка.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(applyEvent, undefined, loadState);
  const [role, setRole] = useState<Role>("family");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state }));
  }, [state]);

  const dispatch = useCallback((event: DomainEvent) => {
    rawDispatch({ kind: "domain", event });
  }, []);

  const reset = useCallback(() => {
    rawDispatch({ kind: "reset" });
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, reset, role, setRole }),
    [state, dispatch, reset, role],
  );

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore вызван вне StoreProvider");
  return store;
}

type StoreAction = { kind: "domain"; event: DomainEvent } | { kind: "reset" };

function applyEvent(state: DomainState, action: StoreAction): DomainState {
  if (action.kind === "reset") return createSeedState();
  return reduce(state, action.event, { now: systemClock.now() });
}

function loadState(): DomainState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as { version?: number; state?: DomainState };
    if (parsed.version !== STORAGE_VERSION || !parsed.state) return createSeedState();
    return parsed.state;
  } catch {
    return createSeedState();
  }
}
