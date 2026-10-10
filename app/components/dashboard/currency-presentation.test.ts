import { describe, expect, it } from "vitest";
import { currencyPresentation, orderCurrencies } from "./currency-presentation";

describe("currency presentation", () => {
  it("keeps the approved original-currency order and identities", () => {
    expect(orderCurrencies(["USD", "CNY", "HKD", "CNY"])).toEqual(["CNY", "HKD", "USD"]);
    expect(currencyPresentation("CNY")).toEqual({ color: "#00d5b6", marker: "circle", label: "CNY" });
    expect(currencyPresentation("HKD")).toEqual({ color: "#b76be7", marker: "diamond", label: "HKD" });
    expect(currencyPresentation("USD")).toEqual({ color: "#78a8ff", marker: "square", label: "USD" });
  });

  it("normalizes and preserves unknown currencies after known currencies", () => {
    expect(orderCurrencies([" eur ", "usd", "cny"])).toEqual(["CNY", "USD", "EUR"]);
    expect(currencyPresentation(" eur ").color).toBe("#94a3b8");
  });
});
