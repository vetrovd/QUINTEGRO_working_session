import type { Booking, BookingStatus } from "./types";

/**
 * Стадия жизни брони: ждёт ответа, идёт, кончилась. Это модель, а не способ
 * разложить список по группам, — поэтому живёт здесь, а не в экране. Иначе
 * каждый новый статус приходится вспоминать в нескольких местах сразу, и
 * забытый статус молча исчезает из интерфейса.
 */
export type BookingStage = "incoming" | "live" | "closed";

export function bookingStage(booking: Booking): BookingStage {
  return stageOf(booking.status);
}

function stageOf(status: BookingStatus): BookingStage {
  switch (status) {
    case "requested":
      return "incoming";
    case "confirmed":
    case "readyToStart":
    case "inProgress":
    case "terminatedEarly":
      return "live";
    // Спор и заявленная сдача — не «живые»: дальше их двигает не ситтер.
    // Но и не закрытые, поэтому в списке они остаются рядом с идущими.
    case "awaitingHandback":
    case "disputed":
      return "live";
    case "completed":
    case "declined":
    case "cancelled":
      return "closed";
  }
}
