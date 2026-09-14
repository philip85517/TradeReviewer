import type { PdfTextPage } from "./pdf-text";
import {
  detectChinaMerchantsStatement,
  parseChinaMerchantsPages,
} from "./china-merchants";
import type {
  DetectionResult,
  StatementBroker,
  StatementParseResult,
} from "./contracts";
import { detectFutuWorkbook, parseFutuWorkbook } from "./futu";
import { detectFutuPdfStatement, parseFutuPdfPages } from "./futu-pdf";
import { FUTU_TIME_RULE_ID } from "./futu-time-policy";
import { createStatementRuleSet } from "./statement-rules";
import { detectTigerStatement, parseTigerPages } from "./tiger";

export const STATEMENT_DETECTION_THRESHOLD = 0.8;

export const STATEMENT_RULES = createStatementRuleSet({
  formats: [
    { id: "futu/xlsx/trades-v1", broker: "futu", status: "supported", priority: 100 },
    { id: "futu/pdf/monthly-v1", broker: "futu", status: "supported", priority: 90 },
    { id: "tiger/pdf/monthly-v1", broker: "tiger", status: "supported", priority: 80 },
    { id: "china-merchants/pdf/monthly-v1", broker: "china-merchants", status: "supported", priority: 70 },
  ],
  time: [{ id: FUTU_TIME_RULE_ID, broker: "futu", version: 1 }],
});

export type StatementAdapterOptions = {
  fileName: string;
  fileFingerprint: string;
  sourceTimezone?: string;
  overrideDocumentTimezone?: boolean;
};

export type StatementPdfAdapter = {
  kind: "pdf";
  id: string;
  broker: StatementBroker;
  detect: (pages: PdfTextPage[]) => DetectionResult;
  parse: (
    pages: PdfTextPage[],
    options: StatementAdapterOptions,
  ) => StatementParseResult;
};

export type StatementWorkbookAdapter = {
  kind: "xlsx";
  id: string;
  broker: StatementBroker;
  detect: (bytes: Uint8Array) => DetectionResult;
  parse: (
    bytes: Uint8Array,
    options: StatementAdapterOptions,
  ) => StatementParseResult;
};

export type StatementAdapter = StatementPdfAdapter | StatementWorkbookAdapter;

export const STATEMENT_ADAPTERS: readonly StatementAdapter[] = Object.freeze([
  {
    kind: "xlsx",
    id: "futu/xlsx/trades-v1",
    broker: "futu",
    detect: (bytes) => detectFutuWorkbook(bytes),
    parse: (bytes, options) =>
      parseFutuWorkbook(bytes, {
        fileName: options.fileName,
        sourceFileId: options.fileFingerprint,
      }),
  },
  {
    kind: "pdf",
    id: "futu/pdf/monthly-v1",
    broker: "futu",
    detect: detectFutuPdfStatement,
    parse: parseFutuPdfPages,
  },
  {
    kind: "pdf",
    id: "tiger/pdf/monthly-v1",
    broker: "tiger",
    detect: detectTigerStatement,
    parse: parseTigerPages,
  },
  {
    kind: "pdf",
    id: "china-merchants/pdf/monthly-v1",
    broker: "china-merchants",
    detect: detectChinaMerchantsStatement,
    parse: parseChinaMerchantsPages,
  },
] satisfies readonly StatementAdapter[]);

export function adaptersFor(kind: "pdf"): readonly StatementPdfAdapter[];
export function adaptersFor(kind: "xlsx"): readonly StatementWorkbookAdapter[];
export function adaptersFor(
  kind: StatementAdapter["kind"],
): readonly StatementAdapter[] {
  return STATEMENT_ADAPTERS.filter((adapter) => adapter.kind === kind);
}
