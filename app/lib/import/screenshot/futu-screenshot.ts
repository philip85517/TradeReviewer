import Decimal from "decimal.js";

import { canonicalInstrumentSymbol } from "../../instruments/display-name";
import type {
  OcrImageResult,
  OcrTextLine,
  ScreenshotFieldEvidence,
  ScreenshotTradeDraft,
  SourceBounds,
} from "./contracts";
import {
  anchorTradeRows,
  detectScreenshotLayout,
} from "./layout-detector";

const LAYOUT_VERSION = "futu-orders-dark-v1";

const FUTU_COLUMNS = {
  anchorMaximumX: 0.15,
  instrument: [0.15, 0.55],
  quantityAndPrice: [0.55, 0.82],
  timestamp: [0.82, 1],
} as const;

function centerX(line: OcrTextLine, image: OcrImageResult): number {
  return (
    (line.sourceBounds.x + line.sourceBounds.width / 2) / image.width
  );
}

function linesInColumn(
  image: OcrImageResult,
  lines: readonly OcrTextLine[],
  [minimum, maximum]: readonly [number, number],
): OcrTextLine[] {
  return lines
    .filter((line) => {
      const x = centerX(line, image);
      return x >= minimum && x < maximum;
    })
    .sort(
      (left, right) =>
        left.sourceBounds.y - right.sourceBounds.y ||
        left.sourceBounds.x - right.sourceBounds.x,
    );
}

function unionBounds(lines: readonly OcrTextLine[]): SourceBounds {
  const left = Math.min(...lines.map((line) => line.sourceBounds.x));
  const top = Math.min(...lines.map((line) => line.sourceBounds.y));
  const right = Math.max(
    ...lines.map(
      (line) => line.sourceBounds.x + line.sourceBounds.width,
    ),
  );
  const bottom = Math.max(
    ...lines.map(
      (line) => line.sourceBounds.y + line.sourceBounds.height,
    ),
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function evidence(
  rawText: string,
  lines: readonly OcrTextLine[],
  repaired = false,
): ScreenshotFieldEvidence {
  const sourceConfidence = Math.min(...lines.map((line) => line.score));
  return {
    rawText,
    confidence: repaired
      ? Math.min(sourceConfidence * 0.9, 0.84)
      : sourceConfidence,
    repaired,
    confirmedByUser: false,
    sourceBounds: unionBounds(lines),
  };
}

function numericValue(line: OcrTextLine | undefined): {
  value?: string;
  evidence?: ScreenshotFieldEvidence;
} {
  if (!line) return {};
  const rawText = line.text.trim();
  const normalized = rawText.replaceAll(",", "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return { evidence: evidence(rawText, [line]) };
  }
  return {
    value: new Decimal(normalized).abs().toString(),
    evidence: evidence(rawText, [line]),
  };
}

function futuMarket(
  image: OcrImageResult,
): ScreenshotTradeDraft["market"] {
  const marker = image.lines
    .map((line) => line.text.replace(/\s+/g, "").toUpperCase())
    .find(
      (text) =>
        text.includes("FUTU") ||
        text.includes("富途") ||
        text.includes("牛牛"),
    );
  if (!marker) return undefined;
  if (marker.includes("HK") || marker.includes("港")) return "HK";
  if (marker.includes("US") || marker.includes("美")) return "US";
  if (marker.includes("SH") || marker.includes("沪")) return "CN-SH";
  if (marker.includes("SZ") || marker.includes("深")) return "CN-SZ";
  return undefined;
}

function timestampValue(lines: readonly OcrTextLine[]): {
  value?: string;
  evidence?: ScreenshotFieldEvidence;
} {
  if (lines.length === 0) return {};
  const rawText = lines.map((line) => line.text.trim()).join(" ");
  return {
    value: rawText,
    evidence: evidence(rawText, lines),
  };
}

export function parseFutuScreenshot(
  image: OcrImageResult,
): ScreenshotTradeDraft[] {
  const layout = detectScreenshotLayout(image);
  if (!layout.matched || layout.broker !== "futu") {
    return [];
  }

  const market = futuMarket(image);
  return anchorTradeRows(image, FUTU_COLUMNS.anchorMaximumX).map((row) => {
    const instrumentLines = linesInColumn(
      image,
      row.lines,
      FUTU_COLUMNS.instrument,
    );
    const symbolLine = instrumentLines.find((line) =>
      /^\d{1,6}$/.test(line.text.trim()),
    );
    const nameLine = instrumentLines.find((line) => line !== symbolLine);
    const rawSymbol = symbolLine?.text.trim();
    const symbol =
      rawSymbol && market
        ? canonicalInstrumentSymbol(rawSymbol, market)
        : undefined;
    const numericLines = linesInColumn(
      image,
      row.lines,
      FUTU_COLUMNS.quantityAndPrice,
    );
    const quantity = numericValue(numericLines[0]);
    const price = numericValue(numericLines[1]);
    const timestamp = timestampValue(
      linesInColumn(image, row.lines, FUTU_COLUMNS.timestamp),
    );
    const usedLines = [
      row.anchor,
      nameLine,
      symbolLine,
      numericLines[0],
      numericLines[1],
      ...linesInColumn(image, row.lines, FUTU_COLUMNS.timestamp),
    ].filter((line): line is OcrTextLine => line !== undefined);
    const fieldEvidence: ScreenshotTradeDraft["fieldEvidence"] = {
      side: evidence(row.anchor.text, [row.anchor]),
    };
    if (symbolLine) {
      fieldEvidence.symbol = evidence(symbolLine.text.trim(), [symbolLine]);
      if (market) {
        fieldEvidence.market = evidence(symbolLine.text.trim(), [symbolLine]);
      }
    }
    if (quantity.evidence) fieldEvidence.quantity = quantity.evidence;
    if (price.evidence) fieldEvidence.price = price.evidence;
    if (timestamp.evidence) {
      fieldEvidence.executedAt = timestamp.evidence;
    }

    return {
      id: `${image.imageId}:futu:${row.sourceRowIndex}`,
      broker: "futu",
      layoutVersion: LAYOUT_VERSION,
      imageId: image.imageId,
      sourceRowIndex: row.sourceRowIndex,
      sourceBounds: unionBounds(usedLines),
      market,
      symbol,
      sourceName: nameLine?.text.trim() || undefined,
      side: row.side,
      quantity: quantity.value,
      price: price.value,
      sourceTimestampText: timestamp.value,
      fieldEvidence,
    };
  });
}
