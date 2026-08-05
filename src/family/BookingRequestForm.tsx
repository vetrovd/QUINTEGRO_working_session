import { useState } from "react";
import { formatMoney, rublesToMinor } from "../domain/money";
import { SEED_FAMILY_ID, SEED_PET_ID, SEED_SITTER_ID } from "../domain/seed";
import { SLOTS_OF_DAY } from "../domain/types";
import type { SlotOfDay } from "../domain/types";
import { useStore } from "../store/StoreProvider";
import { countDays, slotLabel } from "../app/format";
import { Card, Field, SectionTitle, inputClass } from "../app/ui";

/**
 * Временная форма запроса брони. В тикете 02 её заменяет календарь —
 * здесь важен только сам сквозной путь до ситтера.
 */
export function BookingRequestForm() {
  const { state, dispatch } = useStore();
  const sitter = state.sitters[SEED_SITTER_ID];
  const pet = state.pets[SEED_PET_ID];

  const [startDate, setStartDate] = useState("2026-08-10");
  const [endDate, setEndDate] = useState("2026-08-14");
  const [slots, setSlots] = useState<SlotOfDay[]>(["morning", "evening"]);
  const [rateRubles, setRateRubles] = useState(700);

  const days = countDays(startDate, endDate);
  const visits = days * slots.length;
  const totalMinor = visits * rublesToMinor(rateRubles);
  const datesValid = new Date(endDate).getTime() >= new Date(startDate).getTime();
  const canSubmit = datesValid && slots.length > 0 && rateRubles > 0;

  function toggleSlot(slot: SlotOfDay) {
    setSlots((current) =>
      current.includes(slot)
        ? current.filter((item) => item !== slot)
        : SLOTS_OF_DAY.filter((item) => current.includes(item) || item === slot),
    );
  }

  function submit() {
    dispatch({
      type: "BookingRequested",
      bookingId: crypto.randomUUID(),
      familyId: SEED_FAMILY_ID,
      sitterId: SEED_SITTER_ID,
      petId: SEED_PET_ID,
      startDate,
      endDate,
      slots,
      ratePerVisitMinor: rublesToMinor(rateRubles),
    });
  }

  return (
    <section>
      <SectionTitle hint={`Ситтер: ${sitter.name} · питомец: ${pet.name}`}>
        Новая бронь
      </SectionTitle>
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Начало">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Окончание">
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Ставка за визит, ₽">
            <input
              type="number"
              min={0}
              step={50}
              value={rateRubles}
              onChange={(event) => setRateRubles(Number(event.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-stone-700">Визиты в день</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {SLOTS_OF_DAY.map((slot) => (
              <label key={slot} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={slots.includes(slot)}
                  onChange={() => toggleSlot(slot)}
                  className="size-4 accent-stone-900"
                />
                {slotLabel(slot)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <p className="text-sm text-stone-600">
            {datesValid && slots.length > 0 ? (
              <>
                {days} дн. · {visits} визитов · <strong>{formatMoney(totalMinor)}</strong>
              </>
            ) : (
              "Проверьте даты и выберите хотя бы один визит в день"
            )}
          </p>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
          >
            Отправить запрос
          </button>
        </div>
      </Card>
    </section>
  );
}
