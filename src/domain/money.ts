/**
 * Комиссия платформы. Задана здесь и только здесь: ситтеру всегда показываются
 * все три величины — до комиссии, комиссия, на руки.
 */
export const PLATFORM_FEE_RATE = 0.2;

export function feeMinor(grossMinor: number): number {
  return Math.round(grossMinor * PLATFORM_FEE_RATE);
}

export function netMinor(grossMinor: number): number {
  return grossMinor - feeMinor(grossMinor);
}

export const feeRateLabel = `${Math.round(PLATFORM_FEE_RATE * 100)}%`;

/** Рынок задан здесь и только здесь: валюта и локаль форматирования. */
export const LOCALE = "en-US";

/** Деньги хранятся в центах — чтобы расчёты не расходились на дробях. */
const formatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
});

export function formatMoney(minor: number): string {
  return formatter.format(minor / 100);
}

export function dollarsToMinor(dollars: number): number {
  return Math.round(dollars * 100);
}
