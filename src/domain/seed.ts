import { dollarsToMinor } from "./money";
import type { DomainState } from "./types";

export const SEED_NOW = "2026-08-05T09:00:00.000Z";

/** Одна Family, один Sitter, один Pet. Бронирований нет — их создаёт Family. */
export function createSeedState(): DomainState {
  return {
    families: {
      "family-1": {
        id: "family-1",
        name: "The Bennetts",
        address: "1847 Valencia St, Apt 3B, San Francisco, CA 94110",
      },
    },
    sitters: {
      "sitter-1": { id: "sitter-1", name: "Nora Alvarez", ratePerVisitMinor: dollarsToMinor(20) },
    },
    pets: {
      "pet-1": {
        id: "pet-1",
        familyId: "family-1",
        name: "Biscuit",
        species: "Cat, 4 years old",
        careNotes:
          "Dry food twice a day, 1.5 oz per meal. Replace the water entirely, don't top it up. " +
          "Scoop the litter box every visit. Allergy drops in the morning — bottle is on the " +
          "kitchen shelf. Hides under the couch around strangers.",
        careTasks: ["feeding", "water", "litter", "meds"],
      },
    },
    bookings: {},
    visits: {},
    reports: {},
    payouts: {},
    journal: [],
  };
}

export const SEED_FAMILY_ID = "family-1";
export const SEED_SITTER_ID = "sitter-1";
export const SEED_PET_ID = "pet-1";
