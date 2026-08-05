import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { shiftingClock } from "../domain/clock";
import { expiredHandbacks } from "../domain/handback";
import { reduce, reduceAll } from "../domain/reducer";
import { createSeedState } from "../domain/seed";
import type { DomainEvent, DomainState, IsoDateTime, Role } from "../domain/types";

const STORAGE_KEY = "pet-sitting-prototype";
/** Поднимать при любом изменении формы DomainState — иначе старое состояние
 *  загрузится как валидное и упадёт на отсутствующей коллекции. */
const STORAGE_VERSION = 4;
const REQUIRED_COLLECTIONS = [
  "families",
  "sitters",
  "pets",
  "bookings",
  "visits",
  "reports",
  "payouts",
  "journal",
] as const;

interface StoreValue {
  state: DomainState;
  dispatch: (event: DomainEvent) => void;
  reset: () => void;
  role: Role;
  setRole: (role: Role) => void;
  /** Текущее время прототипа: настоящее плюс сдвиг из панели. */
  now: IsoDateTime;
  /** Прокрутить время вперёд — и дать сработать всему, что должно было. */
  advanceHours: (hours: number) => void;
  offsetHours: number;
}

const StoreContext = createContext<StoreValue | null>(null);

/**
 * Оборачивает домен: держит состояние, персистит его и подставляет часы.
 * Вся логика переходов остаётся в reduce (ADR 0002) — здесь только доставка.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const persisted = useRef(loadPersisted()).current;
  const clock = useRef(shiftingClock(undefined, persisted.offsetMs)).current;
  const [state, rawDispatch] = useReducer(applyAction, persisted.state);
  const [role, setRole] = useState<Role>("family");
  const [offsetMs, setOffsetMs] = useState(persisted.offsetMs);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, state, offsetMs }),
    );
  }, [state, offsetMs]);

  const dispatch = useCallback(
    (event: DomainEvent) => {
      rawDispatch({ kind: "domain", event, now: clock.now() });
    },
    [clock],
  );

  const settle = useCallback(() => {
    rawDispatch({ kind: "settle", now: clock.now() });
  }, [clock]);

  const advanceHours = useCallback(
    (hours: number) => {
      clock.advance(hours);
      setOffsetMs(clock.offsetMs());
      settle();
    },
    [clock, settle],
  );

  // Сдвиг времени переживает перезагрузку, поэтому при загрузке надо догнать
  // то, что должно было случиться само, пока страница была закрыта.
  useEffect(settle, [settle]);

  const reset = useCallback(() => {
    // Сброс возвращает и время: иначе новая бронь начинается в сдвинутом дне.
    clock.reset();
    setOffsetMs(0);
    rawDispatch({ kind: "reset" });
  }, [clock]);

  const now = clock.now();
  const value = useMemo(
    () => ({
      state,
      dispatch,
      reset,
      role,
      setRole,
      now,
      advanceHours,
      offsetHours: Math.round(offsetMs / 3_600_000),
    }),
    [state, dispatch, reset, role, now, advanceHours, offsetMs],
  );

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore вызван вне StoreProvider");
  return store;
}

type StoreAction =
  | { kind: "domain"; event: DomainEvent; now: IsoDateTime }
  | { kind: "settle"; now: IsoDateTime }
  | { kind: "reset" };

function applyAction(state: DomainState, action: StoreAction): DomainState {
  switch (action.kind) {
    case "reset":
      return createSeedState();
    case "domain":
      return settleTo(reduce(state, action.event, { now: action.now }), action.now);
    case "settle":
      return settleTo(state, action.now);
  }
}

/**
 * Применяет то, что должно было произойти само к моменту now. Время попадает
 * в домен только так — отдельным событием, а не чтением часов внутри редьюсера.
 */
function settleTo(state: DomainState, now: IsoDateTime): DomainState {
  const events: DomainEvent[] = expiredHandbacks(state, now).map((bookingId) => ({
    type: "HandbackAutoConfirmed",
    bookingId,
  }));
  return events.length === 0 ? state : reduceAll(state, events, { now });
}

function loadPersisted(): { state: DomainState; offsetMs: number } {
  const fresh = { state: createSeedState(), offsetMs: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as {
      version?: number;
      state?: DomainState;
      offsetMs?: number;
    };
    if (parsed.version !== STORAGE_VERSION || !parsed.state) return fresh;
    // Страховка от забытого поднятия версии: не хватает коллекции — начинаем заново.
    if (!REQUIRED_COLLECTIONS.every((key) => key in parsed.state!)) return fresh;
    return { state: parsed.state, offsetMs: parsed.offsetMs ?? 0 };
  } catch {
    return fresh;
  }
}
