import type { DomainState } from "./types";

export const SEED_NOW = "2026-08-05T09:00:00.000Z";

/** Одна Family, один Sitter, один Pet. Бронирований нет — их создаёт Family. */
export function createSeedState(): DomainState {
  return {
    families: {
      "family-1": {
        id: "family-1",
        name: "Ивановы",
        address: "Малая Бронная, 14, кв. 37",
      },
    },
    sitters: {
      "sitter-1": { id: "sitter-1", name: "Марина Соколова" },
    },
    pets: {
      "pet-1": {
        id: "pet-1",
        familyId: "family-1",
        name: "Барсик",
        species: "Кот, 4 года",
        careNotes:
          "Сухой корм дважды в день, по 40 г. Вода — менять целиком. Лоток убрать каждый визит. " +
          "Капли от аллергии утром, флакон на кухонной полке. Прячется под диваном от незнакомых.",
      },
    },
    bookings: {},
    visits: {},
    journal: [],
  };
}

export const SEED_FAMILY_ID = "family-1";
export const SEED_SITTER_ID = "sitter-1";
export const SEED_PET_ID = "pet-1";
