import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { parseBrokerStatement } from "./dispatcher";
import { extractPdfPages } from "./pdf-text";

// Opt-in local integration audit. No private text/account identifiers are logged.
const root = process.env.BROKER_CORPUS_ROOT;
class FileBinaryDataFactory {
  constructor(private urls: Record<string, string | null | undefined>) {}
  async fetch({ kind, filename }: { kind: "cMapUrl" | "standardFontDataUrl" | "wasmUrl"; filename: string }) {
    const base = this.urls[kind];
    if (!base) throw new Error(`Missing ${kind}`);
    return new Uint8Array(await readFile(new URL(filename, base)));
  }
}

it.skipIf(!root)("audits original monthly PDFs through extraction, dispatch, and evidence attachment", async () => {
  const totals = { files: 0, pages: 0, records: 0, positions: 0, events: 0, blocked: 0, review: 0 };
  const codes: Record<string, number> = {};
  for (const folder of ["富途/美股", "富途/港股", "富途/综合", "老虎"]) {
    for (const name of (await readdir(path.join(root!, folder))).filter(n => /^\d{4}-\d{2}\.pdf$/.test(n)).sort()) {
      const buffer = await readFile(path.join(root!, folder, name));
      let pageCount = 0;
      const result = await parseBrokerStatement({ name, arrayBuffer: async () => Uint8Array.from(buffer).buffer }, {
        extractPdfPages: async bytes => {
          const pages = await extractPdfPages(bytes, {
            staticAssetBaseUrl: pathToFileURL(`${process.cwd()}/public/`).href,
            pdfjsLoader: () => import("pdfjs-dist/legacy/build/pdf.mjs"),
            binaryDataFactory: FileBinaryDataFactory,
          });
          pageCount = pages.length;
          return pages;
        },
      });
      expect(result.broker, `${folder}/${name}: recognition`).not.toBe("unknown");
      if (result.broker === "unknown") continue;
      expect(result.monthly, `${folder}/${name}: monthly evidence`).toBeDefined();
      expect(new Set(result.records.map(r => r.id)).size).toBe(result.records.length);
      for (const r of result.records) {
        expect(Number(r.quantity)).toBeGreaterThan(0);
        expect(Number(r.price)).toBeGreaterThan(0);
        expect(r.source.fragments?.length).toBeGreaterThan(0);
      }
      if (folder === "富途/港股" && name === "2022-12.pdf") {
        expect(result.records.filter(record => record.instrument.symbol === "00753")).toHaveLength(7);
      }
      if (folder === "富途/港股" && name === "2020-08.pdf") {
        expect(result.records.find(record => record.instrument.symbol === "03347")).toMatchObject({ source: { venue: "FUTU OTC", displayTimePolicy: "session-open" } });
      }
      if (folder === "富途/港股" && name === "2020-09.pdf") {
        expect(result.records.find(record => record.instrument.symbol === "02101")).toMatchObject({ source: { venue: "FUTU OTC", displayTimePolicy: "session-open" } });
      }
      totals.files++; totals.pages += pageCount; totals.records += result.records.length;
      totals.positions += result.monthly?.positions.length ?? 0;
      totals.events += result.monthly?.events.length ?? 0;
      if (result.blocked) totals.blocked++;
      if (result.monthly?.reviewRequired) totals.review++;
      for (const code of new Set(result.diagnostics.map(d => d.code))) codes[code] = (codes[code] ?? 0) + 1;
    }
  }
  process.stdout.write(`Monthly corpus audit ${JSON.stringify({ totals, codes })}\n`);
  expect(totals.files).toBeGreaterThan(0);
}, 300_000);
