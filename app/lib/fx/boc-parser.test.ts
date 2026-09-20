import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseBocRates } from "./boc-parser";

const fixture = readFileSync(
  resolve(process.cwd(), "app/lib/fx/__fixtures__/boc-source.html"),
  "utf8",
);

describe("parseBocRates", () => {
  it("reads the BOC conversion price without depending on data-currency", () => {
    const html = fixture.replace(/\sdata-currency=['"][^'"]*['"]/giu, "");

    const rates = parseBocRates(html);

    expect(rates.get("USD")).toMatchObject({
      currency: "USD",
      rate: "6.7521",
      publishedAt: "2026-09-19T10:30:00+08:00",
    });
    expect(rates.get("HKD")).toMatchObject({
      currency: "HKD",
      rate: "0.8606",
      publishedAt: "2026-09-19T10:30:00+08:00",
    });
  });

  it("keeps the newest valid row for a currency and rejects blanks, zero, and unknown rows", () => {
    const html = `
      <table id="priceTable">
        <thead><tr><th>货币名称</th><th>中行折算价</th><th>发布日期</th><th>发布时间</th></tr></thead>
        <tr><td>美元</td><td>670.00</td><td>2026/09/18</td><td>18:00:00</td></tr>
        <tr><td>美元</td><td>675.21</td><td>2026/09/19</td><td>10:30:00</td></tr>
        <tr><td>港币</td><td></td><td>2026/09/19</td><td>10:30:00</td></tr>
        <tr><td>港币</td><td>0</td><td>2026/09/19</td><td>10:30:00</td></tr>
        <tr><td>未知币</td><td>999.00</td><td>2026/09/19</td><td>10:30:00</td></tr>
      </table>
    `;

    const rates = parseBocRates(html);

    expect(rates.get("USD")).toMatchObject({
      rate: "6.7521",
      publishedAt: "2026-09-19T10:30:00+08:00",
    });
    expect(rates.has("HKD")).toBe(false);
    expect(rates.has("未知币")).toBe(false);
  });

  it("fails closed when the official table or required headers are missing", () => {
    expect(() => parseBocRates("<html><body>not a rates table</body></html>")).toThrow(
      "BOC price table",
    );
    expect(() => parseBocRates('<table id="priceTable"><tr><th>货币名称</th></tr></table>')).toThrow(
      "BOC price table headers",
    );
  });
});
