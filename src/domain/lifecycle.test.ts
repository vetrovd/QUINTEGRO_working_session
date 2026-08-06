import { describe, expect, it } from "vitest";
import { BOOKING_ID, CTX, booking, closed, confirmed, disputed, handbackRequested, readyToStart, requested } from "./fixtures";
import { bookingStage } from "./lifecycle";
import { reduce } from "./reducer";

/**
 * Стадия — модель, а не группировка списка: если её считать в экране, забытый
 * статус молча исчезает из интерфейса, и бронь пропадает у обеих сторон.
 */
describe("стадия жизни брони", () => {
  it("запрос ждёт ответа — входящий", () => {
    expect(bookingStage(booking(requested()))).toBe("incoming");
  });

  it("принятая и идущая бронь — живая", () => {
    expect(bookingStage(booking(confirmed()))).toBe("live");
    expect(bookingStage(booking(readyToStart()))).toBe("live");
  });

  /** Ход за семьёй, но бронь не кончилась: терять её из списка нельзя. */
  it("заявленная сдача и спор ещё живые", () => {
    expect(bookingStage(booking(handbackRequested()))).toBe("live");
    expect(bookingStage(booking(disputed()))).toBe("live");
  });

  it("закрытая, отклонённая и отменённая — закрытые", () => {
    expect(bookingStage(booking(closed()))).toBe("closed");

    const declined = reduce(requested(), { type: "BookingDeclined", bookingId: BOOKING_ID }, CTX);
    expect(bookingStage(booking(declined))).toBe("closed");

    const cancelled = reduce(confirmed(), { type: "BookingCancelled", bookingId: BOOKING_ID }, CTX);
    expect(bookingStage(booking(cancelled))).toBe("closed");
  });
});
