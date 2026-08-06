import { meetGreetSettled } from "./guards";
import { visitsOfBooking } from "./visits";
import type { BookingId, DomainState } from "./types";

/** Шаги пути брони в том порядке, в котором они проходятся. */
export const TIMELINE_STEPS = [
  "request",
  "meetGreet",
  "keyHandover",
  "care",
  "keyReturn",
  "handback",
] as const;

export type TimelineStep = (typeof TIMELINE_STEPS)[number];

/**
 * Вид строки таймлайна. Ровно четыре, как в спеке: пройден, текущий, будущий
 * и тупик — спор, из которого дальше хода нет.
 */
export type StepPhase = "done" | "current" | "future" | "deadEnd";

/**
 * Где сейчас бронь. Порядок шагов и правило «раскрыт ровно один» — это модель
 * пути, а не оформление, поэтому они живут в домене: интерфейс спрашивает и
 * рисует, но сам не решает, что за чем идёт (ADR 0002).
 */
export function timelineOf(
  state: DomainState,
  bookingId: BookingId,
): Record<TimelineStep, StepPhase> {
  const booking = state.bookings[bookingId];
  if (!booking) return allFuture();

  if (booking.status === "disputed") {
    return { ...allDone(), handback: "deadEnd" };
  }

  const visits = visitsOfBooking(state, bookingId);
  const openVisits = visits.filter(
    (visit) => visit.status === "scheduled" || visit.status === "checkedIn",
  ).length;

  // Оборванный путь не идёт: ни один шаг не текущий, даже если формально
  // ничего не мешает. Заявка, наоборот, сама себе текущий шаг — ход за
  // ситтером, и это надо показать.
  const broken = booking.status === "declined" || booking.status === "cancelled";

  const done: Record<TimelineStep, boolean> = {
    // Заявка пройдена, как только ситтер ответил, — даже отказом: событие
    // состоялось, а чем оно кончилось, написано в самой строке. Красный
    // остаётся за спором: тупик в этой модели ровно один.
    request: booking.status !== "requested",
    meetGreet: meetGreetSettled(booking),
    keyHandover: booking.keys.handover.status === "done",
    // Опека закончилась, когда визиты были и ни одного незакрытого не осталось.
    // Досрочное прерывание снимает оставшиеся, и путь идёт дальше тем же
    // порядком. До принятия брони визитов нет вовсе — это не «всё сделано».
    care: !broken && visits.length > 0 && openVisits === 0,
    keyReturn: booking.keys.return.status === "done",
    handback: booking.status === "completed",
  };

  // Путь линейный, поэтому пройденный шаг закрывает всё, что до него: ключи
  // вернули — значит опека кончилась, даже если часть визитов так и осталась
  // в расписании. Без этого закрытая бронь показывала бы «Визиты» текущим
  // шагом, потому что первый незакрытый ищется с начала списка.
  const reached = TIMELINE_STEPS.reduce(
    (last, step, index) => (done[step] ? index : last),
    -1,
  );
  const settled = (step: TimelineStep) => TIMELINE_STEPS.indexOf(step) <= reached;

  const current = broken ? undefined : TIMELINE_STEPS.find((step) => !settled(step));

  return Object.fromEntries(
    TIMELINE_STEPS.map((step) => [
      step,
      settled(step) ? "done" : step === current ? "current" : "future",
    ]),
  ) as Record<TimelineStep, StepPhase>;
}

function allFuture(): Record<TimelineStep, StepPhase> {
  return fill("future");
}

function allDone(): Record<TimelineStep, StepPhase> {
  return fill("done");
}

function fill(phase: StepPhase): Record<TimelineStep, StepPhase> {
  return Object.fromEntries(TIMELINE_STEPS.map((step) => [step, phase])) as Record<
    TimelineStep,
    StepPhase
  >;
}
