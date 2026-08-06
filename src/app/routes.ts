import type { BookingId, Role, VisitId } from "../domain/types";

/**
 * Маршрут — это роль плюс экран: переключение роли тоже переход, поэтому она
 * живёт в адресе. Разбор и сборка — чистые функции, к DOM здесь не обращаются:
 * так адрес остаётся проверяемым без браузера.
 */
export type Route =
  | { role: "family"; screen: "bookings" }
  | { role: "family"; screen: "newBooking" }
  | { role: "family"; screen: "booking"; bookingId: BookingId }
  | { role: "sitter"; screen: "bookings" }
  | { role: "sitter"; screen: "booking"; bookingId: BookingId }
  // Визит в адресе расписания — переход «из брони в работу»: экран
  // открывается на его карточке и переживает перезагрузку вместе с ней.
  | { role: "sitter"; screen: "schedule"; visitId?: VisitId }
  // Бронь в адресе Earnings — это переход «из работы в деньги»: раздел
  // открывается на её строке и переживает перезагрузку вместе с ней.
  | { role: "sitter"; screen: "earnings"; bookingId?: BookingId };

const FAMILY_HOME: Route = { role: "family", screen: "bookings" };
const SITTER_HOME: Route = { role: "sitter", screen: "bookings" };

/** Куда ведёт неизвестный маршрут и переключение роли. */
export function homeOf(role: Role): Route {
  return role === "family" ? FAMILY_HOME : SITTER_HOME;
}

export function routeToHash(route: Route): string {
  switch (route.screen) {
    case "bookings":
      return `#/${route.role}/bookings`;
    case "newBooking":
      return "#/family/bookings/new";
    case "booking":
      return `#/${route.role}/bookings/${route.bookingId}`;
    case "earnings":
      return route.bookingId ? `#/sitter/earnings/${route.bookingId}` : "#/sitter/earnings";
    case "schedule":
      return route.visitId
        ? `#/sitter/schedule/${encodeURIComponent(route.visitId)}`
        : "#/sitter/schedule";
  }
}

export function parseRoute(hash: string): Route {
  const [role, ...rest] = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (role === "sitter") return sitterRoute(rest);
  if (role === "family") return familyRoute(rest);
  return FAMILY_HOME;
}

function familyRoute([screen, id]: string[]): Route {
  if (screen !== "bookings") return FAMILY_HOME;
  if (id === "new") return { role: "family", screen: "newBooking" };
  if (id) return { role: "family", screen: "booking", bookingId: id };
  return FAMILY_HOME;
}

function sitterRoute([screen, id]: string[]): Route {
  if (screen === "schedule") {
    return { role: "sitter", screen: "schedule", visitId: id ? decodeURIComponent(id) : undefined };
  }
  if (screen === "earnings") return { role: "sitter", screen: "earnings", bookingId: id };
  if (screen === "bookings" && id) return { role: "sitter", screen: "booking", bookingId: id };
  return SITTER_HOME;
}
