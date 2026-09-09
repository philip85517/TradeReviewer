import { isTradingViewCsv, parseTradingViewCsv, type TradingViewInstrument } from "./tradingview";
import type { ImportDiagnostic } from "./import-result";
import type { PdfTextPage } from "./pdf-text";
import { extractPdfPages } from "./pdf-text";
import type { StatementParseResult } from "./contracts";
import { fingerprintBytes } from "./file-fingerprint";
import { attachStatementEvidence } from "./statement-evidence";
import type { StatementTimeOptions } from "./monthly-statement";
import {
  adaptersFor,
  STATEMENT_DETECTION_THRESHOLD,
  type StatementAdapterOptions,
} from "./statement-adapters";

type LocalStatementFile = Pick<File, "name" | "arrayBuffer"> & {
  type?: string;
};

type ExtractPdfPages = (input: ArrayBuffer) => Promise<PdfTextPage[]>;

export type ParseBrokerStatementOptions = StatementTimeOptions & {
  extractPdfPages?: ExtractPdfPages;
  tradingViewInstrument?: TradingViewInstrument;
};

export type StatementDispatchFailure = {
  broker: "unknown";
  records: [];
  candidates: [];
  exclusions: [];
  diagnostics: ImportDiagnostic[];
  blocked: true;
};

export type StatementDispatchResult =
  | StatementParseResult
  | StatementDispatchFailure;

function failure(
  code: "unsupported-statement-format" | "ambiguous-statement-format",
  message: string,
  diagnostics: ImportDiagnostic[] = [],
): StatementDispatchFailure {
  return {
    broker: "unknown",
    records: [],
    candidates: [],
    exclusions: [],
    diagnostics: [
      {
        severity: "error",
        code,
        message,
      },
      ...diagnostics,
    ],
    blocked: true,
  };
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export async function parseBrokerStatement(
  file: LocalStatementFile,
  options: ParseBrokerStatementOptions = {},
): Promise<StatementDispatchResult> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const fileFingerprint = fingerprintBytes(bytes);
  if (isTradingViewCsv(bytes)) return parseTradingViewCsv({fileName:file.name,bytes,fileFingerprint}, options.tradingViewInstrument);
  const workbookDetections = adaptersFor("xlsx").map((adapter) => ({
    adapter,
    detection: adapter.detect(bytes),
  }));
  const workbookMatches = workbookDetections.filter(
    ({ detection }) =>
      detection.matched &&
      detection.confidence >= STATEMENT_DETECTION_THRESHOLD,
  );

  if (workbookMatches.length === 1) {
    return workbookMatches[0].adapter.parse(bytes, {
      fileName: file.name,
      fileFingerprint,
    });
  }
  if (workbookMatches.length > 1) {
    return failure(
      "ambiguous-statement-format",
      "文件同时匹配多个工作表格式，为避免误导入已停止解析",
      workbookDetections.flatMap(({ detection }) => detection.diagnostics ?? []),
    );
  }

  if (!hasPdfSignature(bytes)) {
    return failure(
      "unsupported-statement-format",
      "无法识别该文件，请导入富途 XLSX/PDF、Tiger PDF 或招商证券 PDF 对账单",
      workbookDetections.flatMap(({ detection }) => detection.diagnostics ?? []),
    );
  }

  let pages: PdfTextPage[];
  try {
    pages = await (options.extractPdfPages ?? extractPdfPages)(arrayBuffer);
  } catch {
    return failure(
      "unsupported-statement-format",
      "PDF 文本无法在本地解析，请确认文件未加密且来自受支持的券商",
    );
  }

  const detections = adaptersFor("pdf").map((adapter) => ({
    adapter,
    detection: adapter.detect(pages),
  }));
  const matches = detections.filter(
    ({ detection }) =>
      detection.matched &&
      detection.confidence >= STATEMENT_DETECTION_THRESHOLD,
  );
  const detectorDiagnostics = detections.flatMap(
    ({ detection }) => detection.diagnostics ?? [],
  );

  if (matches.length === 0) {
    return failure(
      "unsupported-statement-format",
      "无法识别该 PDF，请导入富途、Tiger 或招商证券的受支持对账单",
      detectorDiagnostics,
    );
  }
  if (matches.length > 1) {
    return failure(
      "ambiguous-statement-format",
      "文件同时匹配多个券商格式，为避免误导入已停止解析",
      detectorDiagnostics,
    );
  }

  const parseOptions: StatementAdapterOptions = {
    fileName: file.name,
    fileFingerprint,
    sourceTimezone: options.sourceTimezone,
    overrideDocumentTimezone: options.overrideDocumentTimezone,
  };
  const result = matches[0].adapter.parse(pages, parseOptions);
  const withRuleEvidence = {
    ...result,
    records: result.records.map((record) => ({
      ...record,
      source: {
        ...record.source,
        formatRuleId: record.source.formatRuleId ?? matches[0].adapter.id,
      },
    })),
  };
  return withRuleEvidence.monthly
    ? attachStatementEvidence(pages, withRuleEvidence)
    : withRuleEvidence;
}
