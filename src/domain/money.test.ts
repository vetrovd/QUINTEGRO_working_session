import { describe, expect, it } from "vitest";
import { dollarsToMinor, feeMinor, formatMoney, netMinor } from "./money";

/**
 * Деньги — единственное место домена, знающее про валюту и локаль. Проверка
 * держит рынок: суммы должны читаться как американские, а не как переведённые.
 */
describe("деньги", () => {
  it("показывает суммы в долларах", () => {
    expect(formatMoney(2_000)).toBe("$20.00");
  });

  it("показывает центы, а не округляет их", () => {
    expect(formatMoney(1_600)).toBe("$16.00");
    expect(formatMoney(1_650)).toBe("$16.50");
  });

  it("переводит доллары в минорные единицы", () => {
    expect(dollarsToMinor(20)).toBe(2_000);
    expect(dollarsToMinor(0.5)).toBe(50);
  });

  it("удерживает комиссию платформы, оставляя ситтеру остаток", () => {
    expect(feeMinor(2_000)).toBe(400);
    expect(netMinor(2_000)).toBe(1_600);
  });
});
