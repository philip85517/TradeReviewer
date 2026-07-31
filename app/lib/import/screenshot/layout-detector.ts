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
        | "tiger-orders-dark-v1";
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

function compact(text: string): string {
  return text.replace(/\s+/g, "").trim().toLowerCase();
}

function lineCenterX(line: OcrTextLine): number {
  return line.sourceBounds.x + line.sourceBounds.width / 2;
}

function lineCenterY(line: OcrTextLine): number {
  return line.sourceBounds.y + line.sourceBounds.height / 2;
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
  const localRowHeight = image.height * 0.04;
  const anchors = image.lines
    .flatMap((line) => {
      const side = sideFromTradeLabel(line.text);
      return side &&
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
          candidateCenter <= anchor.sourceBounds.y + localRowHeight &&
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
    const fallbackHalfBand = image.height * 0.04;
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
        return candidateCenter >= top && candidateCenter < bottom;
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

export function screenshotHeaderLines(
  image: OcrImageResult,
  aliases: readonly string[],
): OcrTextLine[] {
  return image.lines.filter((line) => {
    const text = compact(line.text);
    return aliases.some(
      (alias) => text === alias || text.includes(alias),
    );
  });
}

export function screenshotHeaderBounds(
  image: OcrImageResult,
  expectedHeaders: ReadonlyArray<readonly string[]>,
): { top: number; bottom: number } | undefined {
  const lines = expectedHeaders.flatMap((aliases) =>
    screenshotHeaderLines(image, aliases),
  );
  if (lines.length === 0) return undefined;

  return {
    top: Math.min(...lines.map((line) => line.sourceBounds.y)),
    bottom: Math.max(
      ...lines.map(
        (line) => line.sourceBounds.y + line.sourceBounds.height,
      ),
    ),
  };
}

function futuScore(image: OcrImageResult): number {
  const title = hasText(image, (text) => text.includes("订单记录"));
  const account = hasText(
    image,
    (text) =>
      text.includes("futu") ||
      text.includes("富途") ||
      text.includes("牛牛"),
  );
  const foundHeaders = FUTU_SCREENSHOT_HEADER_ALIASES.flatMap(
    (aliases, index) =>
      screenshotHeaderLines(image, aliases).length > 0 ? [index] : [],
  );
  const headerBottom =
    screenshotHeaderBounds(image, FUTU_SCREENSHOT_HEADER_ALIASES)
      ?.bottom ?? 0;
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

function tigerScore(image: OcrImageResult): number {
  const title = hasText(
    image,
    (text) =>
      text.includes("订单历史") ||
      text.includes("交易历史") ||
      text.includes("成交记录") ||
      text.includes("orderhistory") ||
      text.includes("transactionhistory"),
  );
  const account = hasText(
    image,
    (text) => text.includes("tiger") || text.includes("老虎"),
  );
  const expectedHeaderLines = TIGER_SCREENSHOT_HEADER_ALIASES.map(
    (aliases) => screenshotHeaderLines(image, aliases)[0],
  );
  const relativeHeaders =
    expectedHeaderLines.every(
      (line): line is OcrTextLine => line !== undefined,
    ) &&
    expectedHeaderLines.every(
      (line, index) =>
        index === 0 ||
        lineCenterX(line!) > lineCenterX(expectedHeaderLines[index - 1]!),
    );
  const headerBottom = Math.max(
    0,
    ...expectedHeaderLines.flatMap((line) =>
      line
        ? [line.sourceBounds.y + line.sourceBounds.height]
        : [],
    ),
  );
  const tradeRow =
    anchorTradeRows(image, {
      maximumNormalizedAnchorX: 0.15,
      minimumAnchorY: headerBottom,
      isCorroboratingLine: (line) =>
        lineCenterX(line) / image.width > 0.12 &&
        !isStructuralScreenshotText(line.text),
    }).length > 0;
  return [title, account, relativeHeaders, tradeRow].filter(Boolean).length /
    4;
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
  const tiger = tigerScore(image);
  const futuMatched = futu >= 0.85;
  const tigerMatched = tiger >= 0.85;

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
    layoutVersion: "tiger-orders-dark-v1",
    confidence: tiger,
  };
}
