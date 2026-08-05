/** Деньги хранятся в копейках — чтобы расчёты не расходились на дробях. */
const formatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatMoney(minor: number): string {
  return formatter.format(minor / 100);
}

export function rublesToMinor(rubles: number): number {
  return Math.round(rubles * 100);
}
