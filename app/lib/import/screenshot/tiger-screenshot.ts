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
  TIGER_FILLED_ORDERS_HEADER_ALIASES,
  TIGER_INSTRUMENT_FIRST_HEADER_ALIASES,
  TIGER_SCREENSHOT_HEADER_ALIASES,
} from "./layout-detector";
import { probableAlphabeticTickerLine } from "./instrument-symbol";
import { selectTimestampValue } from "./timestamp-value";

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

const TIGER_FILLED_ORDERS_COLUMNS = {
  anchorMinimumX: 0.48,
  anchorMaximumX: 0.62,
  instrument: [0, 0.42],
  quantityAndPrice: [0.64, 0.82],
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

function numericValue(
  line: OcrTextLine | undefined,
  preserveScale = false,
): {
  value?: string;
  evidence?: ScreenshotFieldEvidence;
} {
  if (!line) return {};
  const rawText = line.text.trim();
  const normalized = rawText.replaceAll(",", "");
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    return {
      value: preserveScale
        ? normalized
        : new Decimal(normalized).abs().toString(),
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

type TigerInstrumentIdentity = {
  market?: ScreenshotTradeDraft["market"];
  symbol?: string;
  symbolLines: OcrTextLine[];
  nameLine?: OcrTextLine;
};

function explicitMarketCode(
  value: string,
): { market: "US" | "HK"; code: string } | undefined {
  const match = /^(US|HK)\s*([A-Za-z0-9][A-Za-z0-9.-]{0,9})$/i.exec(
    value.trim(),
  );
  if (!match) return undefined;
  return {
    market: match[1].toUpperCase() as "US" | "HK",
    code: normalizePrefixedCode(
      match[2],
      match[1].toUpperCase() as "US" | "HK",
    ),
  };
}

function normalizePrefixedCode(code: string, market: "US" | "HK"): string {
  const normalized = code.trim().toUpperCase();
  return market === "HK"
    ? normalized.replace(/[BOIl]/g, (character) =>
        ({ B: "8", O: "0", I: "1", l: "1" })[character] ?? character,
      )
    : normalized;
}

function prefixedInstrumentIdentity(
  instrumentLines: readonly OcrTextLine[],
): TigerInstrumentIdentity | undefined {
  const ordered = [...instrumentLines].sort(
    (left, right) =>
      left.sourceBounds.y - right.sourceBounds.y ||
      left.sourceBounds.x - right.sourceBounds.x,
  );
  for (const line of ordered) {
    const explicit = explicitMarketCode(line.text);
    if (explicit) {
      return {
        market: explicit.market,
        symbol: explicit.code,
        symbolLines: [line],
        nameLine: ordered.find((candidate) => candidate !== line),
      };
    }
    const unknownPrefix = /^([A-Za-z]{2})\s+([A-Za-z0-9][A-Za-z0-9.-]{0,9})$/.exec(
      line.text.trim(),
    );
    if (unknownPrefix) {
      return {
        symbolLines: [line],
        nameLine: ordered.find((candidate) => candidate !== line),
      };
    }
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const marketLine = ordered[index];
    const market = marketLine.text.trim().toUpperCase();
    if (market !== "US" && market !== "HK") continue;
    const codeLine = ordered[index + 1];
    if (!codeLine || !/^[A-Za-z0-9][A-Za-z0-9.-]{0,9}$/.test(codeLine.text.trim())) {
      return {
        symbolLines: [marketLine],
        nameLine: ordered.find((candidate) => candidate !== marketLine),
      };
    }
    return {
      market: market as "US" | "HK",
      symbol: normalizePrefixedCode(
        codeLine.text,
        market as "US" | "HK",
      ),
      symbolLines: [marketLine, codeLine],
      nameLine: ordered.find(
        (candidate) => candidate !== marketLine && candidate !== codeLine,
      ),
    };
  }

  return undefined;
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
  const selected = selectTimestampValue(lines);
  if (!selected) return {};
  return {
    value: selected.rawText,
    evidence: evidence(selected.rawText, selected.lines),
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
  const filledOrders =
    layout.layoutVersion === "tiger-filled-orders-dark-v1";
  const headers = selectScreenshotHeaders(
    image,
    filledOrders
      ? TIGER_FILLED_ORDERS_HEADER_ALIASES
      : instrumentFirst
        ? TIGER_INSTRUMENT_FIRST_HEADER_ALIASES
        : TIGER_SCREENSHOT_HEADER_ALIASES,
    filledOrders
      ? { minimumNormalizedX: 0.48, maximumNormalizedX: 0.62 }
      : instrumentFirst
        ? { minimumNormalizedX: 0.47, maximumNormalizedX: 0.62 }
        : { maximumNormalizedX: 0.15 },
  );
  const sourceAccountSuffix = tigerAccountSuffix(
    image,
    headers.bounds?.top,
  );
  return anchorTradeRows(image, {
    minimumNormalizedAnchorX: filledOrders
      ? TIGER_FILLED_ORDERS_COLUMNS.anchorMinimumX
      : instrumentFirst
        ? TIGER_INSTRUMENT_FIRST_COLUMNS.anchorMinimumX
        : TIGER_SIDE_FIRST_COLUMNS.anchorMinimumX,
    maximumNormalizedAnchorX: filledOrders
      ? TIGER_FILLED_ORDERS_COLUMNS.anchorMaximumX
      : instrumentFirst
        ? TIGER_INSTRUMENT_FIRST_COLUMNS.anchorMaximumX
        : TIGER_SIDE_FIRST_COLUMNS.anchorMaximumX,
    minimumAnchorY: headers.bounds?.bottom ?? 0,
    isCorroboratingLine: (line) =>
      (filledOrders
        ? centerX(line, image) < TIGER_FILLED_ORDERS_COLUMNS.instrument[1]
        : instrumentFirst
          ? centerX(line, image) <
            TIGER_INSTRUMENT_FIRST_COLUMNS.instrument[1]
          : centerX(line, image) >= TIGER_SIDE_FIRST_COLUMNS.instrument[0]) &&
      !isStructuralScreenshotText(line.text),
  }).map((row) => {
    const instrumentLines = linesInColumn(
      image,
      row.lines,
      filledOrders
        ? TIGER_FILLED_ORDERS_COLUMNS.instrument
        : instrumentFirst
          ? TIGER_INSTRUMENT_FIRST_COLUMNS.instrument
          : TIGER_SIDE_FIRST_COLUMNS.instrument,
    );
    const prefixedIdentity = filledOrders
      ? prefixedInstrumentIdentity(instrumentLines)
      : undefined;
    const symbolLine =
      prefixedIdentity?.symbolLines.at(-1) ??
      instrumentLines.find((line) => /^\d{1,6}$/.test(line.text.trim())) ??
      probableAlphabeticTickerLine(instrumentLines);
    const symbolLines = prefixedIdentity?.symbolLines ??
      (symbolLine ? [symbolLine] : []);
    const nameLine =
      prefixedIdentity?.nameLine ??
      instrumentLines.find((line) => !symbolLines.includes(line));
    const identity = prefixedIdentity ?? symbolMarket(symbolLine?.text);
    const quantityAndPriceLines = linesInColumn(
      image,
      row.lines,
      filledOrders
        ? TIGER_FILLED_ORDERS_COLUMNS.quantityAndPrice
        : instrumentFirst
          ? TIGER_INSTRUMENT_FIRST_COLUMNS.quantityAndPrice
          : TIGER_SIDE_FIRST_COLUMNS.quantity,
    );
    const quantityLine = quantityAndPriceLines[0];
    const priceLine = filledOrders || instrumentFirst
      ? quantityAndPriceLines[1]
      : linesInColumn(
          image,
          row.lines,
          TIGER_SIDE_FIRST_COLUMNS.price,
        )[0];
    const quantity = numericValue(quantityLine, filledOrders);
    const price = numericValue(priceLine, filledOrders);
    const timestampLines = linesInColumn(
      image,
      row.lines,
      filledOrders
        ? TIGER_FILLED_ORDERS_COLUMNS.timestamp
        : instrumentFirst
          ? TIGER_INSTRUMENT_FIRST_COLUMNS.timestamp
          : TIGER_SIDE_FIRST_COLUMNS.timestamp,
    );
    const timestamp = timestampValue(timestampLines);
    const usedLines = [
      row.anchor,
      nameLine,
      ...symbolLines,
      quantityLine,
      priceLine,
      ...timestampLines,
    ].filter((line): line is OcrTextLine => line !== undefined);
    const fieldEvidence: ScreenshotTradeDraft["fieldEvidence"] = {
      side: evidence(row.anchor.text, [row.anchor]),
    };
    if (symbolLine) {
      fieldEvidence.symbol = evidence(symbolLine.text.trim(), symbolLines);
      if (identity.market) {
        fieldEvidence.market = evidence(
          prefixedIdentity?.symbolLines[0]?.text.trim() ??
            symbolLine.text.trim(),
          prefixedIdentity?.symbolLines ?? [symbolLine],
        );
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
