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
  isStructuralScreenshotText,
} from "./layout-detector";

const LAYOUT_VERSION = "tiger-orders-dark-v1";

const TIGER_COLUMNS = {
  anchorMaximumX: 0.12,
  instrument: [0.12, 0.48],
  quantity: [0.48, 0.64],
  price: [0.64, 0.82],
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
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    return {
      value: new Decimal(normalized).abs().toString(),
      evidence: evidence(rawText, [line]),
    };
  }

  const repaired = normalized.replace(/[Oo]/g, "0").replace(/[Il]/g, "1");
  if (
    /\d/.test(normalized) &&
    repaired !== normalized &&
    /^\d+(?:\.\d+)?$/.test(repaired)
  ) {
    return {
      value: new Decimal(repaired).abs().toString(),
      evidence: evidence(rawText, [line], true),
    };
  }
  return { evidence: evidence(rawText, [line]) };
}

function symbolMarket(
  rawSymbol: string | undefined,
): {
  market?: ScreenshotTradeDraft["market"];
  symbol?: string;
} {
  if (!rawSymbol) return {};
  const raw = rawSymbol.trim();
  let market: ScreenshotTradeDraft["market"];
  if (/^\d{1,5}$/.test(raw)) {
    market = "HK";
  } else if (/^6\d{5}$/.test(raw)) {
    market = "CN-SH";
  } else if (/^[03]\d{5}$/.test(raw)) {
    market = "CN-SZ";
  } else if (/^[A-Za-z][A-Za-z0-9.-]{0,9}$/.test(raw)) {
    market = "US";
  }
  return market
    ? { market, symbol: canonicalInstrumentSymbol(raw, market) }
    : {};
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

function headerBottom(image: OcrImageResult): number {
  const headers = new Set([
    "方向",
    "名称/代码",
    "名称代码",
    "成交数量",
    "成交价格",
    "成交时间",
  ]);
  return Math.max(
    0,
    ...image.lines
      .filter((line) =>
        headers.has(line.text.replace(/\s+/g, "").trim()),
      )
      .map((line) => line.sourceBounds.y + line.sourceBounds.height),
  );
}

function tigerAccountSuffix(
  image: OcrImageResult,
  headerBoundary: number,
): string | undefined {
  for (const line of image.lines.filter(
    ({ sourceBounds }) =>
      sourceBounds.y + sourceBounds.height <= headerBoundary,
  )) {
    const match =
      /(?:TIGER(?:\s+BROKERS)?|老虎).*?[·•]\s*((?:[A-Z]\d{3,})|(?:\*+\d{3,})|(?:\d{4,}))\s*$/i.exec(
        line.text.trim(),
      );
    if (match) return match[1].toUpperCase();
  }
  return undefined;
}

function headerTop(image: OcrImageResult): number {
  const headers = new Set([
    "方向",
    "名称/代码",
    "名称代码",
    "成交数量",
    "成交价格",
    "成交时间",
  ]);
  return Math.min(
    Number.POSITIVE_INFINITY,
    ...image.lines
      .filter((line) =>
        headers.has(line.text.replace(/\s+/g, "").trim()),
      )
      .map((line) => line.sourceBounds.y),
  );
}

export function parseTigerScreenshot(
  image: OcrImageResult,
): ScreenshotTradeDraft[] {
  const layout = detectScreenshotLayout(image);
  if (!layout.matched || layout.broker !== "tiger") {
    return [];
  }

  const sourceAccountSuffix = tigerAccountSuffix(
    image,
    headerTop(image),
  );
  return anchorTradeRows(image, {
    maximumNormalizedAnchorX: TIGER_COLUMNS.anchorMaximumX,
    minimumAnchorY: headerBottom(image),
    isCorroboratingLine: (line) =>
      centerX(line, image) >= TIGER_COLUMNS.instrument[0] &&
      !isStructuralScreenshotText(line.text),
  }).map((row) => {
    const instrumentLines = linesInColumn(
      image,
      row.lines,
      TIGER_COLUMNS.instrument,
    );
    const symbolCandidates = instrumentLines.filter((line) => {
        const value = line.text.trim();
        return (
          /^\d{1,6}$/.test(value) ||
          /^[A-Za-z][A-Za-z0-9.-]{0,9}$/.test(value)
        );
      });
    const symbolLine =
      symbolCandidates.find((line) => /^\d{1,6}$/.test(line.text.trim())) ??
      (instrumentLines.length > 1 ? symbolCandidates.at(-1) : undefined);
    const nameLine = instrumentLines.find((line) => line !== symbolLine);
    const identity = symbolMarket(symbolLine?.text);
    const quantityLine = linesInColumn(
      image,
      row.lines,
      TIGER_COLUMNS.quantity,
    )[0];
    const priceLine = linesInColumn(
      image,
      row.lines,
      TIGER_COLUMNS.price,
    )[0];
    const quantity = numericValue(quantityLine);
    const price = numericValue(priceLine);
    const timestampLines = linesInColumn(
      image,
      row.lines,
      TIGER_COLUMNS.timestamp,
    );
    const timestamp = timestampValue(timestampLines);
    const usedLines = [
      row.anchor,
      nameLine,
      symbolLine,
      quantityLine,
      priceLine,
      ...timestampLines,
    ].filter((line): line is OcrTextLine => line !== undefined);
    const fieldEvidence: ScreenshotTradeDraft["fieldEvidence"] = {
      side: evidence(row.anchor.text, [row.anchor]),
    };
    if (symbolLine) {
      fieldEvidence.symbol = evidence(symbolLine.text.trim(), [symbolLine]);
      if (identity.market) {
        fieldEvidence.market = evidence(symbolLine.text.trim(), [symbolLine]);
      }
    }
    if (quantity.evidence) fieldEvidence.quantity = quantity.evidence;
    if (price.evidence) fieldEvidence.price = price.evidence;
    if (timestamp.evidence) {
      fieldEvidence.executedAt = timestamp.evidence;
    }

    return {
      id: `${image.imageId}:tiger:${row.sourceRowIndex}`,
      broker: "tiger",
      layoutVersion: LAYOUT_VERSION,
      imageId: image.imageId,
      sourceRowIndex: row.sourceRowIndex,
      sourceBounds: unionBounds(usedLines),
      market: identity.market,
      symbol: identity.symbol,
      sourceName: nameLine?.text.trim() || undefined,
      side: row.side,
      quantity: quantity.value,
      price: price.value,
      sourceTimestampText: timestamp.value,
      sourceAccountSuffix,
      fieldEvidence,
    };
  });
}
