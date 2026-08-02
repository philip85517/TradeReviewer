import type {
  OcrImageResult,
  OcrTextLine,
} from "./contracts";

export type ScreenshotLayoutDetection =
  | {
      matched: true;
      broker: "futu" | "tiger";
      layoutVersion:
        | "futu-orders-dark-v1"
        | "tiger-orders-dark-v1"
        | "tiger-instrument-first-dark-v1";
      confidence: number;
    }
  | {
      matched: false;
      code: "unsupported-screenshot-layout";
      message: string;
    };

export type AnchoredTradeRow = {
  sourceRowIndex: number;
  side: "buy" | "sell";
  anchor: OcrTextLine;
  lines: OcrTextLine[];
};

export type AnchorTradeRowsOptions = {
  minimumNormalizedAnchorX?: number;
  maximumNormalizedAnchorX: number;
  minimumAnchorY: number;
  isCorroboratingLine: (line: OcrTextLine) => boolean;
};

const UNSUPPORTED_LAYOUT: ScreenshotLayoutDetection = {
  matched: false,
  code: "unsupported-screenshot-layout",
  message: "暂不支持该截图版式，请使用老虎或富途的交易历史截图",
};

const SIDE_BY_LABEL = new Map<string, "buy" | "sell">([
  ["买入", "buy"],
  ["買入", "buy"],
  ["buy", "buy"],
  ["卖出", "sell"],
  ["賣出", "sell"],
  ["sell", "sell"],
]);

export const FUTU_SCREENSHOT_HEADER_ALIASES = [
  ["订单状态"],
  ["名称/代码", "名称代码"],
  ["数量/价格", "数量价格"],
  ["成交时间"],
] as const;

export const TIGER_SCREENSHOT_HEADER_ALIASES = [
  ["方向"],
  ["名称/代码", "名称代码"],
  ["成交数量"],
  ["成交价格"],
  ["成交时间"],
] as const;

export const TIGER_INSTRUMENT_FIRST_HEADER_ALIASES = [
  ["名称/代码", "名称代码"],
  ["方向"],
  ["成交数量"],
  ["成交价格"],
  ["成交时间"],
] as const;

function compact(text: string): string {
  return text.replace(/\s+/g, "").trim().toLowerCase();
}

function lineCenterX(line: OcrTextLine): number {
  return line.sourceBounds.x + line.sourceBounds.width / 2;
}

function lineCenterY(line: OcrTextLine): number {
  return line.sourceBounds.y + line.sourceBounds.height / 2;
}

function rowAssociationWindowHeight(image: OcrImageResult): number {
  const heights = image.lines
    .map((line) => line.sourceBounds.height)
    .filter((height) => Number.isFinite(height) && height > 0)
    .sort((left, right) => left - right);
  const middle = Math.floor(heights.length / 2);
  const medianHeight =
    heights.length === 0
      ? 24
      : heights.length % 2 === 0
        ? (heights[middle - 1] + heights[middle]) / 2
        : heights[middle];

  return Math.min(Math.max(medianHeight * 4, 48), 120);
}

export function sideFromTradeLabel(
  text: string,
): "buy" | "sell" | undefined {
  return SIDE_BY_LABEL.get(compact(text));
}

export function anchorTradeRows(
  image: OcrImageResult,
  options: AnchorTradeRowsOptions,
): AnchoredTradeRow[] {
  const associationWindowHeight = rowAssociationWindowHeight(image);
  const anchors = image.lines
    .flatMap((line) => {
      const side = sideFromTradeLabel(line.text);
      return side &&
        lineCenterX(line) / image.width >=
          (options.minimumNormalizedAnchorX ?? 0) &&
        lineCenterX(line) / image.width <=
          options.maximumNormalizedAnchorX &&
        lineCenterY(line) > options.minimumAnchorY
        ? [{ line, side }]
        : [];
    })
    .filter(({ line: anchor }) =>
      image.lines.some((candidate) => {
        const candidateCenter = lineCenterY(candidate);
        return (
          candidate !== anchor &&
          candidateCenter >= anchor.sourceBounds.y &&
          candidateCenter <=
            anchor.sourceBounds.y + associationWindowHeight &&
          options.isCorroboratingLine(candidate)
        );
      }),
    )
    .sort((left, right) => lineCenterY(left.line) - lineCenterY(right.line));

  return anchors.map(({ line: anchor, side }, index) => {
    const center = lineCenterY(anchor);
    const previousCenter =
      index > 0 ? lineCenterY(anchors[index - 1].line) : undefined;
    const nextCenter =
      index + 1 < anchors.length
        ? lineCenterY(anchors[index + 1].line)
        : undefined;
    const fallbackHalfBand = associationWindowHeight;
    const top =
      previousCenter === undefined
        ? center -
          (nextCenter === undefined
            ? fallbackHalfBand
            : (nextCenter - center) / 2)
        : (previousCenter + center) / 2;
    const bottom =
      nextCenter === undefined
        ? center +
          (previousCenter === undefined
            ? fallbackHalfBand
            : (center - previousCenter) / 2)
        : (center + nextCenter) / 2;

    return {
      sourceRowIndex: index,
      side,
      anchor,
      lines: image.lines.filter((candidate) => {
        const candidateCenter = lineCenterY(candidate);
        return (
          candidateCenter >= Math.max(top, anchor.sourceBounds.y) &&
          candidateCenter <
            Math.min(
              bottom,
              anchor.sourceBounds.y + associationWindowHeight,
            )
        );
      }),
    };
  });
}

function hasText(
  image: OcrImageResult,
  predicate: (text: string) => boolean,
): boolean {
  return image.lines.some((line) => predicate(compact(line.text)));
}

function hasTigerBrandingBefore(
  image: OcrImageResult,
  boundary: number | undefined,
): boolean {
  return (
    boundary !== undefined &&
    image.lines.some(
      (line) =>
        line.sourceBounds.y + line.sourceBounds.height < boundary &&
        (compact(line.text).includes("tiger") ||
          compact(line.text).includes("老虎")),
    )
  );
}

function hasFutuBrandingBefore(
  image: OcrImageResult,
  boundary: number | undefined,
): boolean {
  return (
    boundary !== undefined &&
    image.lines.some(
      (line) =>
        line.sourceBounds.y + line.sourceBounds.height < boundary &&
        (compact(line.text).includes("futu") ||
          compact(line.text).includes("富途") ||
          compact(line.text).includes("牛牛")),
    )
  );
}

export function screenshotHeaderLines(
  image: OcrImageResult,
  aliases: readonly string[],
): OcrTextLine[] {
  return image.lines
    .filter((line) => {
      const text = compact(line.text);
      return aliases.some(
        (alias) => text === alias || text.includes(alias),
      );
    })
    .sort(
      (left, right) =>
        left.sourceBounds.y - right.sourceBounds.y ||
        left.sourceBounds.x - right.sourceBounds.x,
    );
}

export type ScreenshotHeaderSelection = {
  lines: Array<OcrTextLine | undefined>;
  bounds?: { top: number; bottom: number };
};

export function selectScreenshotHeaders(
  image: OcrImageResult,
  expectedHeaders: ReadonlyArray<readonly string[]>,
  anchorRange: {
    minimumNormalizedX?: number;
    maximumNormalizedX: number;
  } = { maximumNormalizedX: 0.15 },
): ScreenshotHeaderSelection {
  const rowAnchorTops = image.lines
    .filter(
      (line) =>
        sideFromTradeLabel(line.text) !== undefined &&
        lineCenterX(line) / image.width >=
          (anchorRange.minimumNormalizedX ?? 0) &&
        lineCenterX(line) / image.width <=
          anchorRange.maximumNormalizedX,
    )
    .map((line) => line.sourceBounds.y);
  if (rowAnchorTops.length === 0) {
    return { lines: expectedHeaders.map(() => undefined) };
  }
  const rowAnchorTop = Math.min(...rowAnchorTops);

  const lines = expectedHeaders.map((aliases) =>
    screenshotHeaderLines(image, aliases).find(
      ({ sourceBounds }) =>
        sourceBounds.y + sourceBounds.height < rowAnchorTop,
    ),
  );
  const selectedLines = lines.filter(
    (line): line is OcrTextLine => line !== undefined,
  );
  if (selectedLines.length === 0) return { lines };

  return {
    lines,
    bounds: {
      top: Math.min(
        ...selectedLines.map((line) => line.sourceBounds.y),
      ),
      bottom: Math.max(
        ...selectedLines.map(
          (line) => line.sourceBounds.y + line.sourceBounds.height,
        ),
      ),
    },
  };
}

function futuScore(image: OcrImageResult): number {
  const title = hasText(image, (text) => text.includes("订单记录"));
  const headers = selectScreenshotHeaders(
    image,
    FUTU_SCREENSHOT_HEADER_ALIASES,
  );
  const account = hasFutuBrandingBefore(image, headers.bounds?.top);
  const foundHeaders = headers.lines.filter(
    (line): line is OcrTextLine => line !== undefined,
  );
  const headerBottom = headers.bounds?.bottom ?? 0;
  const completedRow = anchorTradeRows(image, {
    maximumNormalizedAnchorX: 0.15,
    minimumAnchorY: headerBottom,
    isCorroboratingLine: (line) =>
      lineCenterX(line) / image.width > 0.15 &&
      !isStructuralScreenshotText(line.text),
  }).some((row) =>
    row.lines.some((line) => compact(line.text).includes("全部成交")),
  );
  return [title, account, foundHeaders.length >= 3, completedRow].filter(Boolean)
    .length / 4;
}

function tigerSideFirstScore(image: OcrImageResult): number {
  const title = hasText(
    image,
    (text) =>
      text.includes("订单历史") ||
      text.includes("交易历史") ||
      text.includes("成交记录") ||
      text.includes("orderhistory") ||
      text.includes("transactionhistory"),
  );
  const headers = selectScreenshotHeaders(
    image,
    TIGER_SCREENSHOT_HEADER_ALIASES,
  );
  const account = hasTigerBrandingBefore(image, headers.bounds?.top);
  const expectedHeaderLines = headers.lines;
  const relativeHeaders =
    expectedHeaderLines.every(
      (line): line is OcrTextLine => line !== undefined,
    ) &&
    expectedHeaderLines.every(
      (line, index) =>
        index === 0 ||
        lineCenterX(line!) > lineCenterX(expectedHeaderLines[index - 1]!),
    );
  const headerBottom = headers.bounds?.bottom ?? 0;
  const tradeRow =
    anchorTradeRows(image, {
      maximumNormalizedAnchorX: 0.15,
      minimumAnchorY: headerBottom,
      isCorroboratingLine: (line) =>
        lineCenterX(line) / image.width > 0.12 &&
        !isStructuralScreenshotText(line.text),
    }).length > 0;
  return [title, account, relativeHeaders, tradeRow].filter(Boolean).length / 4;
}

function hasVerticallyStackedLines(lines: readonly OcrTextLine[]): boolean {
  const ordered = [...lines].sort(
    (left, right) => left.sourceBounds.y - right.sourceBounds.y,
  );
  return ordered.some(
    (line, index) =>
      index > 0 &&
      ordered[index - 1].sourceBounds.y +
        ordered[index - 1].sourceBounds.height <=
        line.sourceBounds.y,
  );
}

function isCompleteInstrumentFirstRow(
  image: OcrImageResult,
  row: AnchoredTradeRow,
): boolean {
  const nonStructuralLines = row.lines.filter(
    (line) => !isStructuralScreenshotText(line.text),
  );
  const instrumentLines = nonStructuralLines.filter(
    (line) => lineCenterX(line) / image.width < 0.47,
  );
  const quantityAndPriceLines = nonStructuralLines.filter((line) => {
    const x = lineCenterX(line) / image.width;
    return x >= 0.62 && x < 0.82;
  });
  const timestampLines = nonStructuralLines.filter(
    (line) => lineCenterX(line) / image.width >= 0.82,
  );
  return (
    hasVerticallyStackedLines(instrumentLines) &&
    hasVerticallyStackedLines(quantityAndPriceLines) &&
    timestampLines.length > 0
  );
}

function tigerInstrumentFirstScore(image: OcrImageResult): number {
  const title = hasText(
    image,
    (text) =>
      text.includes("订单历史") ||
      text.includes("交易历史") ||
      text.includes("成交记录") ||
      text.includes("orderhistory") ||
      text.includes("transactionhistory"),
  );
  const headers = selectScreenshotHeaders(
    image,
    TIGER_INSTRUMENT_FIRST_HEADER_ALIASES,
    { minimumNormalizedX: 0.47, maximumNormalizedX: 0.62 },
  );
  const account = hasTigerBrandingBefore(image, headers.bounds?.top);
  const [instrument, side, quantity, price, timestamp] = headers.lines;
  const instrumentFirstHeaders =
    instrument !== undefined &&
    side !== undefined &&
    quantity !== undefined &&
    price !== undefined &&
    timestamp !== undefined &&
    lineCenterX(instrument) < lineCenterX(side) &&
    lineCenterX(side) < lineCenterX(quantity) &&
    Math.abs(lineCenterX(quantity) - lineCenterX(price)) <=
      image.width * 0.08 &&
    lineCenterY(quantity) < lineCenterY(price) &&
    lineCenterY(price) - lineCenterY(quantity) <= image.height * 0.04 &&
    Math.abs(lineCenterY(instrument) - lineCenterY(side)) <=
      image.height * 0.03 &&
    Math.abs(lineCenterY(side) - lineCenterY(timestamp)) <=
      image.height * 0.03 &&
    Math.max(lineCenterX(quantity), lineCenterX(price)) <
      lineCenterX(timestamp);
  const headerBottom = headers.bounds?.bottom ?? 0;
  const completeTradeRows = anchorTradeRows(image, {
    minimumNormalizedAnchorX: 0.47,
    maximumNormalizedAnchorX: 0.62,
    minimumAnchorY: headerBottom,
    isCorroboratingLine: (line) =>
      lineCenterX(line) / image.width < 0.47 &&
      !isStructuralScreenshotText(line.text),
  }).filter((row) => isCompleteInstrumentFirstRow(image, row));
  // With no trusted broker label, two repeated complete rows are the
  // independent evidence that distinguishes this exact history-table structure.
  const tradeRows = completeTradeRows.length >= (account ? 1 : 2);
  return (
    (title ? 0.3 : 0) +
    (account ? 0.1 : 0) +
    (instrumentFirstHeaders ? 0.3 : 0) +
    (tradeRows ? 0.3 : 0)
  );
}

export function isStructuralScreenshotText(text: string): boolean {
  const value = compact(text);
  return (
    value.startsWith("首页订单行情") ||
    value.startsWith("homeordersmarkets") ||
    value === "免责声明" ||
    [
      "订单记录",
      "订单历史",
      "订单状态",
      "名称/代码",
      "名称代码",
      "数量/价格",
      "数量价格",
      "成交时间",
      "方向",
      "成交数量",
      "成交价格",
    ].includes(value)
  );
}

export function detectScreenshotLayout(
  image: OcrImageResult,
): ScreenshotLayoutDetection {
  const futu = futuScore(image);
  const tigerSideFirst = tigerSideFirstScore(image);
  const tigerInstrumentFirst = tigerInstrumentFirstScore(image);
  const futuMatched = futu >= 0.85;
  const tigerSideFirstMatched = tigerSideFirst >= 0.85;
  const tigerInstrumentFirstMatched = tigerInstrumentFirst >= 0.85;
  if (tigerSideFirstMatched && tigerInstrumentFirstMatched) {
    return UNSUPPORTED_LAYOUT;
  }
  const tigerMatched =
    tigerSideFirstMatched || tigerInstrumentFirstMatched;

  if (futuMatched === tigerMatched) {
    return UNSUPPORTED_LAYOUT;
  }
  if (futuMatched) {
    return {
      matched: true,
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
      confidence: futu,
    };
  }
  return {
    matched: true,
    broker: "tiger",
    layoutVersion: tigerInstrumentFirstMatched
      ? "tiger-instrument-first-dark-v1"
      : "tiger-orders-dark-v1",
    confidence: tigerInstrumentFirstMatched
      ? tigerInstrumentFirst
      : tigerSideFirst,
  };
}
