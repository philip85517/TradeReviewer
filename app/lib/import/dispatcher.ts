import type { ImportDiagnostic } from "./import-result";
import type { PdfTextPage } from "./pdf-text";
import { extractPdfPages } from "./pdf-text";
import {
  detectChinaMerchantsStatement,
  parseChinaMerchantsPages,
} from "./china-merchants";
import type { StatementBroker, StatementParseResult } from "./contracts";
import { fingerprintBytes } from "./file-fingerprint";
import { detectFutuWorkbook, parseFutuWorkbook } from "./futu";
import {
  detectTigerStatement,
  parseTigerPages,
} from "./tiger";

const REQUIRED_CONFIDENCE = 0.8;

type LocalStatementFile = Pick<File, "name" | "arrayBuffer"> & {
  type?: string;
};

type ExtractPdfPages = (input: ArrayBuffer) => Promise<PdfTextPage[]>;

export type ParseBrokerStatementOptions = {
  extractPdfPages?: ExtractPdfPages;
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
  const futuDetection = detectFutuWorkbook(bytes);

  if (
    futuDetection.matched &&
    futuDetection.confidence >= REQUIRED_CONFIDENCE
  ) {
    return parseFutuWorkbook(bytes, {
      fileName: file.name,
      sourceFileId: fileFingerprint,
    });
  }

  if (!hasPdfSignature(bytes)) {
    return failure(
      "unsupported-statement-format",
      "无法识别该文件，请导入富途 XLSX、Tiger PDF 或招商证券 PDF 对账单",
      futuDetection.diagnostics,
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

  const detections = [
    {
      broker: "tiger" as const,
      detection: detectTigerStatement(pages),
    },
    {
      broker: "china-merchants" as const,
      detection: detectChinaMerchantsStatement(pages),
    },
  ];
  const matches = detections.filter(
    ({ detection }) =>
      detection.matched &&
      detection.confidence >= REQUIRED_CONFIDENCE,
  );
  const detectorDiagnostics = detections.flatMap(
    ({ detection }) => detection.diagnostics ?? [],
  );

  if (matches.length === 0) {
    return failure(
      "unsupported-statement-format",
      "无法识别该 PDF，请导入 Tiger 或招商证券的受支持对账单",
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

  const broker: Exclude<StatementBroker, "futu"> = matches[0].broker;
  const parseOptions = {
    fileName: file.name,
    fileFingerprint,
  };
  return broker === "tiger"
    ? parseTigerPages(pages, parseOptions)
    : parseChinaMerchantsPages(pages, parseOptions);
}
