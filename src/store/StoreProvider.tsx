import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { ReactNode } from "react";
import { systemClock } from "../domain/clock";
import { reduce } from "../domain/reducer";
import { createSeedState } from "../domain/seed";
import type { DomainEvent, DomainState, IsoDateTime, Role } from "../domain/types";

const STORAGE_KEY = "pet-sitting-prototype";
/** Поднимать при любом изменении формы DomainState — иначе старое состояние
 *  загрузится как валидное и упадёт на отсутствующей коллекции. */
const STORAGE_VERSION = 3;
const REQUIRED_COLLECTIONS = [
  "families",
  "sitters",
  "pets",
  "bookings",
  "visits",
  "reports",
  "journal",
] as const;

interface StoreValue {
  state: DomainState;
  dispatch: (event: DomainEvent) => void;
  reset: () => void;
  role: Role;
  setRole: (role: Role) => void;
  /** Текущее время из часов домена. В тикете 10 их заменят виртуальные. */
  now: IsoDateTime;
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

  const now = systemClock.now();
  const value = useMemo(
    () => ({ state, dispatch, reset, role, setRole, now }),
    [state, dispatch, reset, role, now],
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
    // Страховка от забытого поднятия версии: не хватает коллекции — начинаем заново.
    if (!REQUIRED_COLLECTIONS.every((key) => key in parsed.state!)) return createSeedState();
    return parsed.state;
  } catch {
    return createSeedState();
  }
}
