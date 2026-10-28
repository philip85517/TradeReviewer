import { describe, expect, it } from "vitest";
import { parseStatementCashIdentity } from "./statement-cash-identity";

describe("parseStatementCashIdentity", () => {
  it.each([
    "Handling Charge 500股shs <HKEX 01211 Byd Company Limited>",
    "Scrip Charge 500股shs <HKEX 01211 Byd Company Limited>",
    "HKD0.059058(NET) <HKEX 01211 Byd Company",
    "Scrip Charge <SEHK 01211 Byd Company Limited>",
    "Scrip Charge #01211 Byd Company Limited",
    "Scrip Charge <HKEX 01211> <SEHK 01211> #01211",
  ])("reads explicit Hong Kong reference: %s", text => {
    expect(parseStatementCashIdentity(text)).toEqual({ market: "HK", symbol: "01211" });
  });

  it("preserves unpadded legacy SEHK symbols", () => {
    expect(parseStatementCashIdentity("F/D <SEHK 2382 EXAMPLE>")).toEqual({ market: "HK", symbol: "02382" });
  });

  it.each([
    "",
    "Interest for Month HKD 500 20190726",
    "Handling Charge account 01211",
    "Handling Charge HKEX 01211 Byd Company",
    "Handling Charge HK:01211",
    "Handling Charge (01211)",
    "Scrip Charge <HKEX 012110 Byd>",
    "Scrip Charge <HKEX 01211A Byd>",
    "Scrip Charge <HKEX 1211 Byd>",
    "Scrip Charge #012110",
    "Scrip Charge #01211A",
    "Scrip Charge <HKEX 01211> <SEHK 00700>",
    "Scrip Charge #01211 #00700",
    "Scrip Charge <HKEX 01211> #00700",
    "Handling Charge <HKEX 01211> <NASDAQ AAPL>",
    "Handling Charge <NASDAQ AAPL>",
    "Handling Charge <SSE 600519>",
    "Handling Charge <SZSE 000001>",
    "Handling Charge <HKEX 01211> US0378331005",
    "Handling Charge <SEHK 01211> HK0000123456",
    "Handling Charge <SEHK 01211 option>",
    "Handling Charge <HKEX 01211> AAPL250117C00100000",
    "Handling Charge <HKEX 01211 基金>",
    "Handling Charge <HKEX 01211 Fund>",
    "Handling Charge <HKEX 01211 期權>",
  ])("does not invent an identity for unsupported or ambiguous text: %s", text => {
    expect(parseStatementCashIdentity(text)).toBeUndefined();
  });
});
