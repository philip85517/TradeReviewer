import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractPdfPages } from "../../../../app/lib/import/pdf-text.ts";
import { parseBrokerStatement } from "../../../../app/lib/import/dispatcher.ts";
import { reconcileExecutions } from "../../../../app/lib/import/execution-reconciliation.ts";
import { enrichStatementImport } from "../../../../app/lib/import/enrich-import.ts";

const fixtureDir = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(fixtureDir, "../../../../");

class FileBinaryDataFactory {
  async fetch({
    kind,
    filename,
  }: {
    kind: "cMapUrl" | "standardFontDataUrl" | "wasmUrl";
    filename: string;
  }) {
    const base =
      kind === "cMapUrl"
        ? path.join(repoRoot, "node_modules/pdfjs-dist/cmaps")
        : path.join(repoRoot, "node_modules/pdfjs-dist/standard_fonts");
    return new Uint8Array(await readFile(path.join(base, filename)));
  }
}

async function parse(name: string) {
  const bytes = await readFile(path.join(fixtureDir, name));
  return parseBrokerStatement(
    {
      name,
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    },
    {
      extractPdfPages: async (input) =>
        extractPdfPages(input, {
          staticAssetBaseUrl: "file:///synthetic/",
          pdfjsLoader: () => import("pdfjs-dist/legacy/build/pdf.mjs"),
          binaryDataFactory: FileBinaryDataFactory,
        }),
    },
  );
}

const parsed = new Map<string, Awaited<ReturnType<typeof parse>>>();
const reports: Record<string, unknown> = {};
for (const name of ["futu-synthetic-monthly-v1.pdf", "futu-synthetic-monthly-v2-corrected.pdf"]) {
  const result = await parse(name);
  parsed.set(name, result);
  const enriched = result.broker === "futu" ? await enrichStatementImport(result, {}) : undefined;
  reports[name] = {
    broker: result.broker,
    blocked: result.blocked,
    diagnostics: result.diagnostics,
    monthly: result.monthly,
    enriched: enriched ? { importable: enriched.importable.length, unresolved: enriched.unresolved.length, names: enriched.importable.map((record) => record.instrument.name) } : undefined,
    records: result.records.map((record) => ({
      id: record.id,
      accountId: record.accountId,
      instrument: record.instrument,
      quantity: record.quantity,
      price: record.price,
      fee: record.fee,
      executedAt: record.executedAt,
      source: {
        fileFingerprint: record.source.fileFingerprint,
        statementMonth: record.source.statementMonth,
        templateId: record.source.templateId,
        formatRuleId: record.source.formatRuleId,
      },
    })),
  };
}

const first = parsed.get("futu-synthetic-monthly-v1.pdf");
const second = parsed.get("futu-synthetic-monthly-v2-corrected.pdf");
if (first?.broker === "futu" && second?.broker === "futu") {
  const reconciliation = reconcileExecutions(first.records, second.records);
  reports.reconciliation = {
    conflicts: reconciliation.conflicts.map((conflict) => ({
      id: conflict.id,
      existing: conflict.existing.map((record) => ({ id: record.id, quantity: record.quantity, fileFingerprint: record.source.fileFingerprint })),
      incoming: conflict.incoming.map((record) => ({ id: record.id, quantity: record.quantity, fileFingerprint: record.source.fileFingerprint })),
    })),
    acceptedIncoming: reconciliation.acceptedIncoming.map((record) => record.id),
  };
}

console.log(JSON.stringify(reports, null, 2));
