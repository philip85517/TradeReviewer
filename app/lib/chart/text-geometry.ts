export type TextFontSize = 12 | 14 | 16 | 18 | 24 | 32;

export type TextLayout = {
  width: number;
  lineHeight: number;
  lines: string[];
  height: number;
};

/**
 * CSS custom properties are not resolved by CanvasRenderingContext2D. Keep
 * the font family in a Canvas-valid form so live and exported text use the
 * same measured 14px default.
 */
export const CANVAS_TEXT_FONT_FAMILY =
  '"Geist", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
export const CANVAS_MONO_FONT_FAMILY =
  '"Geist Mono", "SFMono-Regular", Consolas, monospace';

export function canvasTextFont(
  fontSize: TextFontSize | number,
  weight = 600,
) {
  return `${weight} ${fontSize}px ${CANVAS_TEXT_FONT_FAMILY}`;
}

export function canvasMonoFont(fontSize: number, weight = 600) {
  return `${weight} ${fontSize}px ${CANVAS_MONO_FONT_FAMILY}`;
}

export type TextCardLayout = TextLayout & {
  fullLines: string[];
  fullHeight: number;
  canExpand: boolean;
  collapsed: boolean;
  /** True when an expanded card is bounded by the visible plot height. */
  truncated: boolean;
};

export type TextCardPoint = { x: number; y: number };

export type TextCardGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: TextCardPoint;
  connectorStart: TextCardPoint;
  connectorEnd: TextCardPoint;
};

const TEXT_HORIZONTAL_PADDING = 4;
// The visible label stays compact, while the control itself keeps a 44px
// touch target. The reserved lane prevents it from covering the final line.
const TEXT_CARD_CONTROL_WIDTH = 44;
const TEXT_CARD_CONTROL_HEIGHT = 44;

function wrapText(
  value: string,
  width: number,
  measure: (value: string) => number,
) {
  const lines: string[] = [];
  for (const sourceLine of value.split("\n")) {
    let line = "";
    for (const character of sourceLine) {
      const candidate = line + character;
      if (line && measure(candidate) > width) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

function estimatedCharacterWidth(character: string, fontSize: number) {
  const codePoint = character.codePointAt(0) ?? 0;
  if (/\s/u.test(character)) return fontSize * 0.34;
  // CJK, full-width punctuation and emoji occupy an em in the configured
  // fallback families. Latin glyphs use a narrower average width.
  if (
    codePoint >= 0x1100 &&
    (codePoint <= 0x11ff ||
      codePoint >= 0x2e80 && codePoint <= 0x9fff ||
      codePoint >= 0xac00 && codePoint <= 0xd7af ||
      codePoint >= 0xff00 && codePoint <= 0xffef ||
      codePoint >= 0x1f000)
  ) {
    return fontSize;
  }
  return fontSize * 0.62;
}

function estimatedTextWidth(value: string, fontSize: number) {
  return Array.from(value).reduce(
    (total, character) => total + estimatedCharacterWidth(character, fontSize),
    0,
  );
}

/**
 * Text geometry shared by rendering, hit-testing, editor placement, and
 * capture warnings. `maxWidth` is the current canvas width; `textWidth` is
 * the stored desired width and is deliberately left untouched by this clamp.
 */
export function textLayout(
  value: string,
  textWidth: number,
  fontSize: TextFontSize,
  maxWidth: number,
  reserveRight = 0,
): TextLayout {
  const width = Math.min(
    Math.max(1, maxWidth),
    Math.max(36, Number.isFinite(textWidth) ? textWidth : 180),
  );
  const lineHeight = Math.round(fontSize * 1.5);
  const averageCharacterWidth = Math.max(1, fontSize * 0.72);
  const lines = wrapText(
    value,
    // The painter uses the same four-pixel inset on both sides. Keeping the
    // measurement budget in sync prevents a full-width CJK line from
    // painting beyond the card edge.
    Math.max(1, width - TEXT_HORIZONTAL_PADDING * 2 - Math.max(0, reserveRight)),
    (candidate) =>
      candidate.length === 0
        ? 0
        : estimatedTextWidth(candidate, fontSize) ||
          Array.from(candidate).length * averageCharacterWidth,
  );
  return {
    width,
    lineHeight,
    lines,
    height: Math.max(lineHeight, lines.length * lineHeight) + 8,
  };
}

function summaryLine(line: string, fontSize: number, maxWidth: number) {
  const characters = Array.from(line);
  let visible = characters;
  while (visible.length > 0 && estimatedTextWidth(`${visible.join("")}…`, fontSize) > maxWidth) {
    visible = visible.slice(0, -1);
  }
  return `${visible.join("")}…`;
}

/**
 * A short on-chart summary never changes the raw drawing text. The complete
 * wrapped lines remain available to the editor and capture/export callers.
 */
export function textCardLayout(
  value: string,
  textWidth: number,
  fontSize: TextFontSize,
  maxWidth: number,
  expanded = false,
  maxHeight = Number.POSITIVE_INFINITY,
  reserveRight = 0,
  reserveBottom = 0,
): TextCardLayout {
  const full = textLayout(
    value,
    Math.max(
      textWidth,
      reserveRight + TEXT_HORIZONTAL_PADDING * 2,
    ),
    fontSize,
    maxWidth,
    reserveRight,
  );
  const canExpand = full.lines.length > 2;
  const collapsed = canExpand && !expanded;
  const summaryLines = collapsed
    ? full.lines.slice(0, 2).map((line, index, all) =>
        index === all.length - 1
          ? summaryLine(
              line,
              fontSize,
              Math.max(1, full.width - TEXT_HORIZONTAL_PADDING * 2 - Math.max(0, reserveRight)),
            )
          : line,
      )
    : [...full.lines];
  const boundedHeight = Number.isFinite(maxHeight)
    ? Math.max(full.lineHeight + 8 + reserveBottom, maxHeight)
    : Number.POSITIVE_INFINITY;
  const maxVisibleLines = Number.isFinite(maxHeight)
    ? Math.max(1, Math.floor((boundedHeight - reserveBottom - 8) / full.lineHeight))
    : Number.POSITIVE_INFINITY;
  const truncated = expanded && summaryLines.length > maxVisibleLines;
  const lines = truncated
    ? summaryLines.slice(0, maxVisibleLines).map((line, index, all) =>
        index === all.length - 1
          ? summaryLine(
              line,
              fontSize,
              Math.max(1, full.width - TEXT_HORIZONTAL_PADDING * 2 - Math.max(0, reserveRight)),
            )
          : line,
      )
    : summaryLines;
  const height = Math.min(
    Math.max(full.lineHeight, lines.length * full.lineHeight) + 8 + reserveBottom,
    boundedHeight,
  );
  return {
    ...full,
    lines,
    height,
    fullLines: [...full.lines],
    fullHeight: full.height + reserveBottom,
    canExpand,
    collapsed,
    truncated,
  };
}

function nearestPointOnRect(
  point: TextCardPoint,
  x: number,
  y: number,
  width: number,
  height: number,
): TextCardPoint {
  const right = x + width;
  const bottom = y + height;
  const inside = point.x >= x && point.x <= right && point.y >= y && point.y <= bottom;
  if (!inside) {
    return {
      x: Math.max(x, Math.min(right, point.x)),
      y: Math.max(y, Math.min(bottom, point.y)),
    };
  }

  const distances = [
    { distance: point.x - x, point: { x, y: point.y } },
    { distance: right - point.x, point: { x: right, y: point.y } },
    { distance: point.y - y, point: { x: point.x, y } },
    { distance: bottom - point.y, point: { x: point.x, y: bottom } },
  ];
  return distances.reduce((nearest, candidate) =>
    candidate.distance < nearest.distance ? candidate : nearest,
  ).point;
}

/**
 * Keeps the card inside the plot while leaving its time-price anchor fixed.
 * The two connector points are deliberately returned for hit-test and paint
 * callers so live and capture cannot invent different line endpoints.
 */
export function textCardGeometry(
  anchor: TextCardPoint,
  desired: TextCardPoint,
  layout: Pick<TextLayout, "width" | "height">,
  plotWidth: number,
  plotHeight: number,
): TextCardGeometry {
  const margin = 4;
  const width = Math.min(layout.width, Math.max(1, plotWidth - margin * 2));
  const height = Math.min(layout.height, Math.max(1, plotHeight - margin * 2));
  const maxX = Math.max(margin, plotWidth - width - margin);
  const maxY = Math.max(margin, plotHeight - height - margin);
  const x = Math.max(margin, Math.min(maxX, desired.x));
  const y = Math.max(margin, Math.min(maxY, desired.y));
  return {
    x,
    y,
    width,
    height,
    anchor,
    connectorStart: nearestPointOnRect(anchor, x, y, width, height),
    connectorEnd: anchor,
  };
}

export const textCardLayoutOptions = {
  controlWidth: TEXT_CARD_CONTROL_WIDTH,
  controlHeight: TEXT_CARD_CONTROL_HEIGHT,
  horizontalPadding: TEXT_HORIZONTAL_PADDING,
} as const;
