import {
  buildInstrumentTradeSummaries,
  type InstrumentTradeSummary,
} from "../trades/instruments";
import type { TradeExecution } from "../trades/types";
import type { ImportDiagnostic, ImportResult } from "./import-result";

export type ImportPreview = {
  id: string;
  fileName: string;
  sourceLabel: string;
  records: TradeExecution[];
  instruments: InstrumentTradeSummary[];
  diagnostics: ImportDiagnostic[];
  tradeCount: number;
  instrumentCount: number;
  excludedInstrumentCount: number;
  excludedSymbols: string[];
  firstTradeAt?: string;
  lastTradeAt?: string;
  blocked: boolean;
};

function sourceLabel(records: TradeExecution[]) {
  const platform = records[0]?.source.platform;
  if (platform === "futu") return "富途证券";
  return platform ? platform.toUpperCase() : "未识别";
}

export function createImportPreview(
  fileName: string,
  result: ImportResult<TradeExecution>,
): ImportPreview {
  const instruments = buildInstrumentTradeSummaries(result.records);
  const excludedSymbols = [
    ...new Set(
      result.diagnostics
        .filter((item) => item.code === "unsupported-asset-class")
        .map((item) => item.instrumentSymbol)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const times = result.records
    .map((record) => record.executedAt)
    .sort((a, b) => a.localeCompare(b));
  const fingerprint =
    result.records[0]?.source.fileFingerprint ??
    `${fileName}:${result.records.length}`;

  return {
    id: `import:${fingerprint}`,
    fileName,
    sourceLabel: sourceLabel(result.records),
    records: result.records,
    instruments,
    diagnostics: result.diagnostics,
    tradeCount: result.records.length,
    instrumentCount: instruments.length,
    excludedInstrumentCount: excludedSymbols.length,
    excludedSymbols,
    firstTradeAt: times[0],
    lastTradeAt: times.at(-1),
    blocked: result.blocked || result.records.length === 0,
  };
}
