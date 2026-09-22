import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { parseBrokerStatement } from "./dispatcher";
import { extractPdfPages } from "./pdf-text";

// Opt-in local integration audit. The corpus stays outside the repository and
// no source text, account identifier, or instrument list is logged.
const root = process.env.CHINA_MERCHANTS_CORPUS_ROOT;

class FileBinaryDataFactory {
  constructor(private urls: Record<string, string | null | undefined>) {}

  async fetch({
    kind,
    filename,
  }: {
    kind: "cMapUrl" | "standardFontDataUrl" | "wasmUrl";
    filename: string;
  }) {
    const base = this.urls[kind];
    if (!base) throw new Error(`Missing ${kind}`);
    return new Uint8Array(await readFile(new URL(filename, base)));
  }
}

it.skipIf(!root)(
  "audits the original China Merchants A-share PDFs for inventory invariants",
  async () => {
    const names = (await readdir(root!))
      .filter((name) => name.toLowerCase().endsWith(".pdf"))
      .sort();
    expect(names.length).toBeGreaterThan(0);

    const totals = {
      files: 0,
      pages: 0,
      records: 0,
      positions: 0,
      reviewRequired: 0,
      inconsistentBalances: 0,
    };

    for (const name of names) {
      const buffer = await readFile(path.join(root!, name));
      let pageCount = 0;
      const result = await parseBrokerStatement(
        {
          name,
          arrayBuffer: async () => Uint8Array.from(buffer).buffer,
        },
        {
          extractPdfPages: async (bytes) => {
            const pages = await extractPdfPages(bytes, {
              staticAssetBaseUrl: pathToFileURL(
                `${process.cwd()}/public/`,
              ).href,
              pdfjsLoader: () => import("pdfjs-dist/legacy/build/pdf.mjs"),
              binaryDataFactory: FileBinaryDataFactory,
            });
            pageCount = pages.length;
            return pages;
          },
        },
      );

      expect(result.broker, `${name}: recognition`).toBe("china-merchants");
      expect(result.blocked, `${name}: import must not be blocked`).toBe(false);
      if (result.broker !== "china-merchants") {
        throw new Error(`${name}: expected China Merchants parser result`);
      }
      expect(result.monthly, `${name}: monthly evidence`).toBeDefined();
      expect(new Set(result.records.map((record) => record.id)).size).toBe(
        result.records.length,
      );
      for (const record of result.records) {
        expect(Number(record.quantity), `${name}: quantity`).toBeGreaterThan(0);
        expect(Number(record.price), `${name}: price`).toBeGreaterThan(0);
      }

      const positions = result.monthly?.positions ?? [];
      for (const position of positions) {
        if (position.market === "CN-SH" || position.market === "CN-SZ") {
          expect(
            Number(position.quantity),
            `${name}: A-share position cannot be negative`,
          ).toBeGreaterThanOrEqual(0);
        }
      }
      const inconsistentBalanceCount = result.diagnostics.filter(
        (diagnostic) =>
          diagnostic.code === "inconsistent-china-merchants-security-balance",
      ).length;
      if (inconsistentBalanceCount > 0) {
        expect(result.monthly?.reviewRequired).toBe(true);
      }

      totals.files += 1;
      totals.pages += pageCount;
      totals.records += result.records.length;
      totals.positions += positions.length;
      totals.reviewRequired += result.monthly?.reviewRequired ? 1 : 0;
      totals.inconsistentBalances += inconsistentBalanceCount;
    }

    process.stdout.write(`China Merchants corpus audit ${JSON.stringify(totals)}\n`);
  },
  300_000,
);
