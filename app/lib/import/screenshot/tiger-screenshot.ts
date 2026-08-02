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
  selectScreenshotHeaders,
  TIGER_INSTRUMENT_FIRST_HEADER_ALIASES,
  TIGER_SCREENSHOT_HEADER_ALIASES,
} from "./layout-detector";
import { probableAlphabeticTickerLine } from "./instrument-symbol";

const TIGER_SIDE_FIRST_COLUMNS = {
  anchorMinimumX: 0,
  anchorMaximumX: 0.12,
  instrument: [0.12, 0.48],
  quantity: [0.48, 0.64],
  price: [0.64, 0.82],
  timestamp: [0.82, 1],
} as const;

const TIGER_INSTRUMENT_FIRST_COLUMNS = {
  anchorMinimumX: 0.47,
  anchorMaximumX: 0.62,
  instrument: [0, 0.47],
  quantityAndPrice: [0.62, 0.82],
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
  const normalizedLines = lines.map((line) => ({
    line,
    text: line.text.replace(/\s+/g, " ").trim(),
  }));
  const dateLines = normalizedLines.filter(({ text }) =>
    /(?:^|\D)\d{2,4}\s*(?:[/.\-]|年)\s*\d{1,2}\s*(?:[/.\-]|月)\s*\d{1,2}(?:日)?(?=$|\D)/.test(
      text,
    ),
  );
  const timeLines = normalizedLines.filter(({ text }) =>
    /(?:^|\D)\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?(?=$|\D)/.test(
      text,
    ),
  );
  const timestampPairs = dateLines.flatMap((date) =>
    timeLines
      .filter(
        (time) =>
          time.line.sourceBounds.y >= date.line.sourceBounds.y,
      )
      .map((time) => ({
        date,
        time,
        distance: Math.abs(
          date.line.sourceBounds.y +
            date.line.sourceBounds.height / 2 -
            (time.line.sourceBounds.y + time.line.sourceBounds.height / 2),
        ),
      })),
  );
  const closestPair = timestampPairs.reduce<
    (typeof timestampPairs)[number] | undefined
  >(
    (closest, pair) =>
      !closest || pair.distance < closest.distance ? pair : closest,
    undefined,
  );
  if (closestPair) {
    const selectedLines =
      closestPair.date.line === closestPair.time.line
        ? [closestPair.date.line]
        : [closestPair.date.line, closestPair.time.line];
    const rawText =
      closestPair.date.line === closestPair.time.line
        ? closestPair.date.text
        : `${closestPair.date.text} ${closestPair.time.text}`;
    return {
      value: rawText,
      evidence: evidence(rawText, selectedLines),
    };
  }
  const rawText = normalizedLines.map(({ text }) => text).join(" ");
  return {
    value: rawText,
    evidence: evidence(rawText, lines),
  };
}

function tigerAccountSuffix(
  image: OcrImageResult,
  headerBoundary: number | undefined,
): string | undefined {
  if (
    headerBoundary === undefined ||
    !Number.isFinite(headerBoundary)
  ) {
    return undefined;
  }
  for (const line of image.lines.filter(
    ({ sourceBounds }) =>
      sourceBounds.y + sourceBounds.height < headerBoundary,
  )) {
    const match =
      /(?:TIGER(?:\s+BROKERS)?|老虎).*?[·•]\s*((?:[A-Z]\d{3,})|(?:\*+\d{3,})|(?:\d{4,}))\s*$/i.exec(
        line.text.trim(),
      );
    if (match) return match[1].toUpperCase();
  }
  return undefined;
}

export function parseTigerScreenshot(
  image: OcrImageResult,
): ScreenshotTradeDraft[] {
  const layout = detectScreenshotLayout(image);
  if (!layout.matched || layout.broker !== "tiger") {
    return [];
  }

  const instrumentFirst =
    layout.layoutVersion === "tiger-instrument-first-dark-v1";
  const headers = selectScreenshotHeaders(
    image,
    instrumentFirst
      ? TIGER_INSTRUMENT_FIRST_HEADER_ALIASES
      : TIGER_SCREENSHOT_HEADER_ALIASES,
    instrumentFirst
      ? { minimumNormalizedX: 0.47, maximumNormalizedX: 0.62 }
      : { maximumNormalizedX: 0.15 },
  );
  const sourceAccountSuffix = tigerAccountSuffix(
    image,
    headers.bounds?.top,
  );
  return anchorTradeRows(image, {
    minimumNormalizedAnchorX: instrumentFirst
      ? TIGER_INSTRUMENT_FIRST_COLUMNS.anchorMinimumX
      : TIGER_SIDE_FIRST_COLUMNS.anchorMinimumX,
    maximumNormalizedAnchorX: instrumentFirst
      ? TIGER_INSTRUMENT_FIRST_COLUMNS.anchorMaximumX
      : TIGER_SIDE_FIRST_COLUMNS.anchorMaximumX,
    minimumAnchorY: headers.bounds?.bottom ?? 0,
    isCorroboratingLine: (line) =>
      (instrumentFirst
        ? centerX(line, image) <
          TIGER_INSTRUMENT_FIRST_COLUMNS.instrument[1]
        : centerX(line, image) >=
          TIGER_SIDE_FIRST_COLUMNS.instrument[0]) &&
      !isStructuralScreenshotText(line.text),
  }).map((row) => {
    const instrumentLines = linesInColumn(
      image,
      row.lines,
      instrumentFirst
        ? TIGER_INSTRUMENT_FIRST_COLUMNS.instrument
        : TIGER_SIDE_FIRST_COLUMNS.instrument,
    );
    const symbolLine =
      instrumentLines.find((line) => /^\d{1,6}$/.test(line.text.trim())) ??
      probableAlphabeticTickerLine(instrumentLines);
    const nameLine = instrumentLines.find((line) => line !== symbolLine);
    const identity = symbolMarket(symbolLine?.text);
    const quantityAndPriceLines = linesInColumn(
      image,
      row.lines,
      instrumentFirst
        ? TIGER_INSTRUMENT_FIRST_COLUMNS.quantityAndPrice
        : TIGER_SIDE_FIRST_COLUMNS.quantity,
    );
    const quantityLine = quantityAndPriceLines[0];
    const priceLine = instrumentFirst
      ? quantityAndPriceLines[1]
      : linesInColumn(
          image,
          row.lines,
          TIGER_SIDE_FIRST_COLUMNS.price,
        )[0];
    const quantity = numericValue(quantityLine);
    const price = numericValue(priceLine);
    const timestampLines = linesInColumn(
      image,
      row.lines,
      instrumentFirst
        ? TIGER_INSTRUMENT_FIRST_COLUMNS.timestamp
        : TIGER_SIDE_FIRST_COLUMNS.timestamp,
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
      layoutVersion: layout.layoutVersion,
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
