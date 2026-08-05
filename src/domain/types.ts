export type IsoDateTime = string;
/** Календарная дата в формате YYYY-MM-DD, всегда локальная. */
export type IsoDate = string;

export type FamilyId = string;
export type SitterId = string;
export type PetId = string;
export type BookingId = string;
export type VisitId = string;
export type PayoutId = string;

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

export const CARE_TASKS = ["feeding", "water", "litter", "walk", "meds"] as const;
export type CareTask = (typeof CARE_TASKS)[number];

export interface Pet {
  id: PetId;
  familyId: FamilyId;
  name: string;
  species: string;
  careNotes: string;
  /** Чеклист для отчёта: у кота нет прогулки, у собаки нет лотка. */
  careTasks: CareTask[];
}

/**
 * Статусы брони. `awaitingHandback` — ситтер заявил сдачу работы, ждём семью;
 * `completed` — семья подтвердила, и только тогда деньги разблокированы
 * (ADR 0001). Остальные ветки закрытия — disputed и terminatedEarly —
 * добавляют тикеты 11 и 12.
 */
export type BookingStatus =
  | "requested"
  | "confirmed"
  | "readyToStart"
  | "inProgress"
  | "awaitingHandback"
  | "completed"
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

/** Визит завершается отправкой отчёта, а не уходом ситтера из дома. */
export type VisitStatus = "scheduled" | "checkedIn" | "completed" | "cancelled";

export interface Visit {
  id: VisitId;
  bookingId: BookingId;
  date: IsoDate;
  slot: SlotOfDay;
  status: VisitStatus;
  checkedInAt?: IsoDateTime;
  completedAt?: IsoDateTime;
}

export type VisitReportStatus = "draft" | "submitted";

/**
 * Отчёт по одному визиту. После отправки неизменяем — это доказательство
 * выполненной работы. Семья его читает, но не акцептует: прочтение не
 * двигает деньги (ADR 0001).
 */
export interface VisitReport {
  visitId: VisitId;
  /** Выполненные задачи из чеклиста питомца. */
  tasks: CareTask[];
  note: string;
  /** Фото как data URL — прототип живёт в localStorage. */
  photos: string[];
  status: VisitReportStatus;
  updatedAt: IsoDateTime;
  submittedAt?: IsoDateTime;
  readByFamilyAt?: IsoDateTime;
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
  handbackRequestedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  declineReason?: string;
}

/**
 * Вывод денег — набор начислений, а не сумма: начисление либо выведено целиком,
 * либо не выведено, половины визита не бывает. Сами суммы не хранятся, они
 * считаются по визитам вывода — иначе история могла бы разойтись с деньгами.
 *
 * В отличие от Earning, Payout хранится: «вывел» — это факт, который из
 * состояния визитов не вывести. В прототипе вывод мгновенный, поэтому
 * requested → paid отдельными событиями не разделён.
 */
export interface Payout {
  id: PayoutId;
  sitterId: SitterId;
  visitIds: VisitId[];
  paidAt: IsoDateTime;
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
  | { type: "VisitCheckedIn"; visitId: VisitId }
  | {
      type: "VisitReportSaved";
      visitId: VisitId;
      tasks: CareTask[];
      note: string;
      photos: string[];
    }
  | { type: "VisitReportSubmitted"; visitId: VisitId }
  | { type: "VisitReportRead"; visitId: VisitId }
  /** Ситтер заявляет сдачу работы: ключи вернул, визиты закрыл. */
  | { type: "HandbackRequested"; bookingId: BookingId }
  /** Семья подтверждает закрытие — единственное событие, которое даёт ситтеру
   *  доступ к деньгам (ADR 0001). Авто-подтверждение по таймауту — тикет 10. */
  | { type: "HandbackConfirmed"; bookingId: BookingId }
  | {
      type: "PayoutRequested";
      payoutId: PayoutId;
      sitterId: SitterId;
      /** Начисления, входящие в вывод. Ситтер выбирает, что выводить. */
      visitIds: VisitId[];
    };

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
  /** Ключ — визит: на один визит ровно один отчёт. */
  reports: Record<VisitId, VisitReport>;
  payouts: Record<PayoutId, Payout>;
  journal: JournalEntry[];
}
