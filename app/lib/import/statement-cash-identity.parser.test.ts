import { describe, expect, it } from "vitest";
import { attachStatementEvidence } from "./statement-evidence";
import type { StatementParseResult } from "./contracts";
import type { PdfTextPage } from "./pdf-text";

function parseCashRow(description: string, options: { section?: "cash" | "asset"; date?: string; amount?: string; deposit?: boolean } = {}) {
  const { section = "cash", date = "2019/07/26", amount = "-1.50", deposit = false } = options;
  const rows: [number, string][][] = [
    [[40, "賬戶幣種"], [150, "HKD"]],
    [[40, section === "cash" ? "資金進出" : "資產進出"]],
    [[40, "類型"], [160, "日期"], [300, "金額"], [410, "單號"], [520, "備註"]],
    [[40, deposit ? "存入現金" : "提取現金"], [160, date], [300, amount], [410, "5349442"], [520, description]],
  ];
  const page: PdfTextPage = {
    pageNumber: 2, width: 1200, height: 900,
    items: rows.flatMap((cells, row) => cells.map(([x, text]) => ({ x, y: 100 + row * 28, text, width: text.length * 6, height: 10 }))),
  };
  const result: StatementParseResult = {
    broker: "futu", records: [], candidates: [], exclusions: [], diagnostics: [], blocked: false,
    monthly: { documentId: "cash-identity-fixture", templateIds: [], accountId: "acct", month: date.slice(0, 7).replace("/", "-"), positions: [], events: [], reviewRequired: false },
  };
  return attachStatementEvidence([page], result);
}

describe("statement cash reference identity", () => {
  it.each([
    ["Handling Charge 500股shs <HKEX 01211 Byd Company Limited>", "-30.00"],
    ["Scrip Charge 500股shs <HKEX 01211 Byd Company Limited>", "-1.50"],
  ])("preserves the fee event while identifying %s", (description, amount) => {
    const parsed = parseCashRow(description, { amount });
    expect(parsed.monthly?.events).toEqual([{
      documentId: "cash-identity-fixture", id: "cash-identity-fixture:evidence:2:4", accountId: "acct",
      market: "HK", symbol: "01211", date: "2019-07-26", kind: "fee", amount, currency: "HKD",
      description: `提取現金 2019/07/26 ${amount} 5349442 ${description}`,
      source: [{ page: 2, row: 4, role: "cash" }],
    }]);
    expect(parsed.monthly?.events[0].quantity).toBeUndefined();
    expect(parsed.records).toEqual([]);
    expect(parsed.diagnostics).toEqual([]);
  });

  it("identifies a truncated exchange reference without changing the existing event kind", () => {
    const description = "HKD0.059058(NET) <HKEX 01211 Byd Company";
    const parsed = parseCashRow(description, { date: "2020/08/18", amount: "+29.53", deposit: true });
    expect(parsed.monthly?.events).toEqual([{
      documentId: "cash-identity-fixture", id: "cash-identity-fixture:evidence:2:4", accountId: "acct",
      market: "HK", symbol: "01211", date: "2020-08-18", kind: "other", amount: "29.53", currency: "HKD",
      description: `存入現金 2020/08/18 +29.53 5349442 ${description}`,
      source: [{ page: 2, row: 4, role: "cash" }],
    }]);
    expect(parsed.monthly?.events[0].quantity).toBeUndefined();
  });

  it("uses the same explicit reference in the asset table", () => {
    const parsed = parseCashRow("Scrip Charge 500股shs <HKEX 01211 Byd Company Limited>", { section: "asset" });
    expect(parsed.monthly?.events[0]).toMatchObject({ market: "HK", symbol: "01211", kind: "fee", amount: "-1.50", source: [{ page: 2, row: 4, role: "asset" }] });
    expect(parsed.monthly?.events[0].quantity).toBeUndefined();
  });

  it.each(["Scrip Charge <SEHK 01211 Byd Company Limited>", "Scrip Charge #01211 Byd Company Limited"])("retains legacy reference %s", description => {
    expect(parseCashRow(description).monthly?.events[0]).toMatchObject({ market: "HK", symbol: "01211", kind: "fee" });
  });

  it.each([
    "Interest for Month HKD 500 20190726",
    "Handling Charge account 01211",
    "Scrip Charge <HKEX 012110 Byd Company Limited>",
    "Scrip Charge #012110",
    "Scrip Charge <HKEX 01211 Byd> <SEHK 00700 Tencent>",
    "Scrip Charge #01211 #00700",
    "Scrip Charge <SEHK 01211 option>",
    "Handling Charge <HKEX 01211> US0378331005",
    "Handling Charge <NASDAQ AAPL>",
    "Handling Charge <SSE 600519>",
    "Handling Charge <SZSE 000001>",
  ])("leaves an unsupported or ambiguous cash identity unassigned: %s", description => {
    const [event] = parseCashRow(description).monthly!.events;
    expect(event.market).toBeUndefined();
    expect(event.symbol).toBeUndefined();
    expect(event.amount).toBe("-1.50");
    expect(event.kind).toBe("fee");
    expect(event.quantity).toBeUndefined();
  });
});
