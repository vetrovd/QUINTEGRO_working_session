import { describe, expect, it } from "vitest";
import {
  BOOKING_ID,
  CTX,
  NOW,
  TODAY_MORNING,
  checkedIn,
  lastRejection,
  readyToStart,
  run,
} from "./fixtures";
import { canMarkReportRead, canSaveVisitReport, canSubmitVisitReport } from "./guards";
import { reduce } from "./reducer";
import { submittedReportsOfBooking, unreadReportsCount, visitsAwaitingReport } from "./reports";
import type { DomainEvent } from "./types";

const save = (
  overrides: Partial<Extract<DomainEvent, { type: "VisitReportSaved" }>> = {},
): DomainEvent => ({
  type: "VisitReportSaved",
  visitId: TODAY_MORNING,
  tasks: ["feeding", "water"],
  note: "Барсик поел, вылез из-под дивана",
  photos: [],
  ...overrides,
});

const submit: DomainEvent = { type: "VisitReportSubmitted", visitId: TODAY_MORNING };
const markRead: DomainEvent = { type: "VisitReportRead", visitId: TODAY_MORNING };

function report(state: ReturnType<typeof checkedIn>) {
  return state.reports[TODAY_MORNING];
}

describe("черновик отчёта", () => {
  it("нельзя заполнять отчёт до отметки прихода", () => {
    expect(canSaveVisitReport(readyToStart(), TODAY_MORNING)).toMatchObject({
      allowed: false,
      reason: "Сначала отметьте приход на визит",
    });

    const state = reduce(readyToStart(), save(), CTX);

    expect(state.reports[TODAY_MORNING]).toBeUndefined();
    expect(lastRejection(state)).toBeDefined();
  });

  it("сохраняется и перезаписывается, не завершая визит", () => {
    const state = run(
      [save(), save({ note: "Дополнил: сменил воду", tasks: ["feeding", "water", "litter"] })],
      checkedIn(),
    );

    expect(report(state)).toMatchObject({
      status: "draft",
      tasks: ["feeding", "water", "litter"],
      note: "Дополнил: сменил воду",
    });
    expect(state.visits[TODAY_MORNING].status).toBe("checkedIn");
  });

  it("на визит приходится ровно один отчёт", () => {
    const state = run([save(), save(), save()], checkedIn());

    expect(Object.keys(state.reports)).toEqual([TODAY_MORNING]);
  });
});

describe("отправка отчёта", () => {
  it("завершает визит и фиксирует время", () => {
    const state = run([save(), submit], checkedIn());

    expect(report(state)).toMatchObject({ status: "submitted", submittedAt: NOW });
    expect(state.visits[TODAY_MORNING]).toMatchObject({ status: "completed", completedAt: NOW });
  });

  it("невозможна без черновика", () => {
    const state = reduce(checkedIn(), submit, CTX);

    expect(lastRejection(state)).toBe("Заполните отчёт перед отправкой");
    expect(state.visits[TODAY_MORNING].status).toBe("checkedIn");
  });

  it("невозможна для пустого отчёта", () => {
    const empty = reduce(checkedIn(), save({ tasks: [], note: "   ", photos: [] }), CTX);

    expect(canSubmitVisitReport(empty, TODAY_MORNING)).toMatchObject({
      allowed: false,
      reason: "Отметьте выполненные задачи, приложите фото или напишите заметку",
    });
  });

  it("проходит, если из содержимого есть только фото", () => {
    const state = run(
      [save({ tasks: [], note: "", photos: ["data:image/jpeg;base64,AAA"] }), submit],
      checkedIn(),
    );

    expect(report(state).status).toBe("submitted");
  });
});

describe("неизменяемость отправленного отчёта", () => {
  it("сохранение поверх отправленного отклоняется", () => {
    const submitted = run([save(), submit], checkedIn());
    const state = reduce(submitted, save({ note: "Задним числом" }), CTX);

    expect(report(state).note).toBe("Барсик поел, вылез из-под дивана");
    expect(lastRejection(state)).toBe("Отчёт отправлен — изменить его нельзя");
  });

  it("повторная отправка отклоняется", () => {
    const submitted = run([save(), submit], checkedIn());
    const state = reduce(submitted, submit, CTX);

    expect(lastRejection(state)).toBe("Отчёт отправлен — изменить его нельзя");
  });

  it("завершённый визит нельзя отметить пришедшим заново", () => {
    const submitted = run([save(), submit], checkedIn());
    const state = reduce(submitted, { type: "VisitCheckedIn", visitId: TODAY_MORNING }, CTX);

    expect(state.visits[TODAY_MORNING].status).toBe("completed");
    expect(lastRejection(state)).toBe("Визит уже завершён");
  });
});

describe("лента семьи", () => {
  it("показывает только отправленные отчёты", () => {
    const draft = reduce(checkedIn(), save(), CTX);

    expect(submittedReportsOfBooking(draft, BOOKING_ID)).toHaveLength(0);

    const submitted = reduce(draft, submit, CTX);

    expect(submittedReportsOfBooking(submitted, BOOKING_ID)).toHaveLength(1);
  });

  it("отправленный отчёт непрочитан, прочтение снимает пометку", () => {
    const submitted = run([save(), submit], checkedIn());

    expect(unreadReportsCount(submitted, BOOKING_ID)).toBe(1);

    const read = reduce(submitted, markRead, CTX);

    expect(unreadReportsCount(read, BOOKING_ID)).toBe(0);
    expect(read.reports[TODAY_MORNING].readByFamilyAt).toBe(NOW);
  });

  it("нельзя прочитать черновик и нельзя прочитать дважды", () => {
    const draft = reduce(checkedIn(), save(), CTX);

    expect(canMarkReportRead(draft, TODAY_MORNING)).toMatchObject({
      allowed: false,
      reason: "Отчёт ещё не сдан",
    });

    const read = run([submit, markRead], draft);
    const again = reduce(read, markRead, CTX);

    expect(lastRejection(again)).toBe("Отчёт уже прочитан");
  });

  it("визит без сданного отчёта остаётся в списке ожидающих", () => {
    const state = reduce(checkedIn(), save(), CTX);

    expect(visitsAwaitingReport(state, BOOKING_ID).map((visit) => visit.id)).toEqual([
      TODAY_MORNING,
    ]);

    const submitted = reduce(state, submit, CTX);

    expect(visitsAwaitingReport(submitted, BOOKING_ID)).toHaveLength(0);
  });
});
