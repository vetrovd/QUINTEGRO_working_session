export type IsoDateTime = string;
export type IsoDate = string;

export type FamilyId = string;
export type SitterId = string;
export type PetId = string;
export type BookingId = string;

export type Role = "family" | "sitter";

export const SLOTS_OF_DAY = ["morning", "midday", "evening"] as const;
export type SlotOfDay = (typeof SLOTS_OF_DAY)[number];

export interface Family {
  id: FamilyId;
  name: string;
  address: string;
}

export interface Sitter {
  id: SitterId;
  name: string;
}

export interface Pet {
  id: PetId;
  familyId: FamilyId;
  name: string;
  species: string;
  careNotes: string;
}

/**
 * Статусы до старта опеки. Остальной жизненный цикл Booking'а
 * (readyToStart, inProgress, awaitingHandback, completed, ...) добавляется
 * следующими тикетами.
 */
export type BookingStatus = "requested" | "confirmed" | "declined" | "cancelled";

export interface Booking {
  id: BookingId;
  familyId: FamilyId;
  sitterId: SitterId;
  petId: PetId;
  startDate: IsoDate;
  endDate: IsoDate;
  slots: SlotOfDay[];
  ratePerVisitMinor: number;
  status: BookingStatus;
  requestedAt: IsoDateTime;
  respondedAt?: IsoDateTime;
  cancelledAt?: IsoDateTime;
  declineReason?: string;
}

export type DomainEvent =
  | {
      type: "BookingRequested";
      bookingId: BookingId;
      familyId: FamilyId;
      sitterId: SitterId;
      petId: PetId;
      startDate: IsoDate;
      endDate: IsoDate;
      slots: SlotOfDay[];
      ratePerVisitMinor: number;
    }
  | { type: "BookingAccepted"; bookingId: BookingId }
  | { type: "BookingDeclined"; bookingId: BookingId; reason?: string }
  | { type: "BookingCancelled"; bookingId: BookingId };

/**
 * Запись журнала. Отклонённый переход тоже попадает сюда — молча ничего не
 * теряется, и в тикете 10 журнал станет видимым в панели прототипа.
 */
export interface JournalEntry {
  at: IsoDateTime;
  event: DomainEvent;
  rejection?: string;
}

export interface DomainState {
  families: Record<FamilyId, Family>;
  sitters: Record<SitterId, Sitter>;
  pets: Record<PetId, Pet>;
  bookings: Record<BookingId, Booking>;
  journal: JournalEntry[];
}
