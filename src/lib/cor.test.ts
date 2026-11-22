// Regra 11.20: contraste da cor de destaque com o texto branco (WCAG).
import { describe, expect, it } from "vitest";
import { contrasteComBranco, corValida } from "./cor";

describe("contraste com branco (11.20)", () => {
  it("valores conhecidos", () => {
    expect(contrasteComBranco("#000000")).toBe(21);
    expect(contrasteComBranco("#ffffff")).toBe(1);
    expect(contrasteComBranco("#0071e3")).toBeGreaterThanOrEqual(4.5); // o azul padrão passa
    expect(contrasteComBranco("#ffd60a")).toBeLessThan(4.5); // amarelo não passa
  });
  it("formato #rrggbb", () => {
    expect(corValida("#0B5CAD")).toBe(true);
    expect(corValida("0b5cad")).toBe(false);
    expect(corValida("#fff")).toBe(false);
  });
});
