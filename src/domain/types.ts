export type IsoDateTime = string;
/** Календарная дата в формате YYYY-MM-DD, всегда локальная. */
export type IsoDate = string;

export type FamilyId = string;
export type SitterId = string;
export type PetId = string;
export type BookingId = string;
export type VisitId = string;

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
 * Статусы до и во время опеки. Закрытие (awaitingHandback, completed,
 * disputed, terminatedEarly) добавляют тикеты 08, 11 и 12.
 */
export type BookingStatus =
  | "requested"
  | "confirmed"
  | "readyToStart"
  | "inProgress"
  | "declined"
  | "cancelled";

export type MeetGreetStatus = "none" | "proposed" | "accepted" | "happened" | "skipped";

/** Знакомство одноразовое на пару Family↔Sitter: повторная бронь его пропускает. */
export interface MeetGreet {
  status: MeetGreetStatus;
  proposedBy?: Role;
  meetingAt?: IsoDateTime;
}

export type KeyHandoverDirection = "handover" | "return";
export type KeyHandoverMethod = "inPerson" | "lockbox" | "doorCode";
export type KeyHandoverStatus = "pending" | "proposed" | "done";

/** Передача доступа в дом. Состоялась только при подтверждении обеими сторонами. */
export interface KeyHandover {
  status: KeyHandoverStatus;
  method?: KeyHandoverMethod;
  meetingAt?: IsoDateTime;
  details?: string;
  proposedBy?: Role;
  confirmedByFamily: boolean;
  confirmedBySitter: boolean;
}

export type VisitStatus = "scheduled" | "checkedIn" | "cancelled";

export interface Visit {
  id: VisitId;
  bookingId: BookingId;
  date: IsoDate;
  slot: SlotOfDay;
  status: VisitStatus;
  checkedInAt?: IsoDateTime;
}

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
  meetGreet: MeetGreet;
  keys: Record<KeyHandoverDirection, KeyHandover>;
  requestedAt: IsoDateTime;
  respondedAt?: IsoDateTime;
  cancelledAt?: IsoDateTime;
  startedAt?: IsoDateTime;
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
  | { type: "BookingCancelled"; bookingId: BookingId }
  | { type: "MeetGreetProposed"; bookingId: BookingId; by: Role; meetingAt: IsoDateTime }
  | { type: "MeetGreetAccepted"; bookingId: BookingId; by: Role }
  | { type: "MeetGreetHappened"; bookingId: BookingId }
  | {
      type: "KeyHandoverProposed";
      bookingId: BookingId;
      direction: KeyHandoverDirection;
      by: Role;
      method: KeyHandoverMethod;
      meetingAt: IsoDateTime;
      details?: string;
    }
  | {
      type: "KeyHandoverConfirmed";
      bookingId: BookingId;
      direction: KeyHandoverDirection;
      by: Role;
    }
  | { type: "VisitCheckedIn"; visitId: VisitId };

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
  visits: Record<VisitId, Visit>;
  journal: JournalEntry[];
}
