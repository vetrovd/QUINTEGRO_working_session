import { meetGreetSettled } from "./guards";
import { visitsOfBooking } from "./visits";
import type { BookingId, DomainState } from "./types";

/** Шаги пути брони в том порядке, в котором они проходятся. */
export const TIMELINE_STEPS = [
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

  // Пока бронь не принята или уже оборвана, путь не идёт: ни один шаг не
  // текущий, даже если формально ничего не мешает.
  const stalled =
    booking.status === "requested" ||
    booking.status === "declined" ||
    booking.status === "cancelled";

  const done: Record<TimelineStep, boolean> = {
    meetGreet: meetGreetSettled(booking),
    keyHandover: booking.keys.handover.status === "done",
    // Опека закончилась, когда визиты были и ни одного незакрытого не осталось.
    // Досрочное прерывание снимает оставшиеся, и путь идёт дальше тем же
    // порядком. До принятия брони визитов нет вовсе — это не «всё сделано».
    care: !stalled && visits.length > 0 && openVisits === 0,
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

  const current = stalled ? undefined : TIMELINE_STEPS.find((step) => !settled(step));

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
