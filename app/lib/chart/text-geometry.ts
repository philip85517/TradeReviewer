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

export type DrawingControlRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** A transient chart-local obstruction; never persisted with a drawing. */
export type DrawingControlObstacle = DrawingControlRect & {
  id: string;
};

export type TextCardControlObstacleSource = {
  id: string;
  body: DrawingControlRect;
};

/**
 * Build transient obstacles for sibling text cards. The body prevents a
 * control from landing on another card's readable surface. Sibling expand /
 * collapse buttons are rendered at the card's right edge, so reserve only
 * their top and bottom bands instead of treating the entire card halo as an
 * unavailable surface.
 */
export function textCardControlObstacles(
  cards: readonly TextCardControlObstacleSource[],
  currentId: string,
  controlSize: number,
  gap = 6,
): DrawingControlObstacle[] {
  const controlBand = controlSize + gap;
  return cards
    .filter((card) => card.id !== currentId)
    .flatMap((card) => {
      const { body } = card;
      return [
        { ...body, id: `text-body-${card.id}` },
        {
          left: body.right - controlBand,
          top: body.top - gap,
          right: body.right + gap,
          bottom: body.top + controlBand,
          id: `text-controls-top-${card.id}`,
        },
        {
          left: body.right - controlBand,
          top: body.bottom - controlBand,
          right: body.right + gap,
          bottom: body.bottom + gap,
          id: `text-controls-bottom-${card.id}`,
        },
      ];
    });
}

export type AvailableControlRect = {
  rect: DrawingControlRect;
  available: boolean;
};

export type ControlPlacement = AvailableControlRect & {
  index: number;
};

export type JointControlPlacementInput = {
  id: string;
  candidates: readonly DrawingControlRect[];
  obstacles?: readonly DrawingControlObstacle[];
};


function controlRectsOverlap(left: DrawingControlRect, right: DrawingControlRect) {
  return left.left < right.right && right.left < left.right &&
    left.top < right.bottom && right.top < left.bottom;
}

/**
 * Keep the first candidate as the explicit fallback so keyboard activation
 * remains possible when a tiny chart leaves no pointer-safe rectangle.
 */
export function chooseAvailableControlRect(
  candidates: readonly DrawingControlRect[],
  obstacles: readonly DrawingControlObstacle[] = [],
): AvailableControlRect | null {
  const placement = chooseAvailableControlPlacement(candidates, obstacles);
  if (!placement) return null;
  return { rect: placement.rect, available: placement.available };
}

/**
 * Return the first pointer-safe candidate while retaining its index for
 * callers that render only one of several transient controls. The first
 * candidate remains the explicit keyboard fallback when every candidate is
 * blocked, preserving the existing compatibility contract.
 */
export function chooseAvailableControlPlacement(
  candidates: readonly DrawingControlRect[],
  obstacles: readonly DrawingControlObstacle[] = [],
): ControlPlacement | null {
  const fallback = candidates[0];
  if (!fallback) return null;
  const index = candidates.findIndex((candidate) =>
    !obstacles.some((obstacle) => controlRectsOverlap(candidate, obstacle)),
  );
  const resolvedIndex = index >= 0 ? index : 0;
  return {
    index: resolvedIndex,
    rect: candidates[resolvedIndex]!,
    available: index >= 0,
  };
}

/**
 * Place a small group of same-card controls in one transient space. Each
 * later control sees both the external obstacles and the already placed
 * controls, while the first candidate remains the explicit keyboard
 * fallback when no pointer-safe candidate exists.
 */
export function chooseJointControlPlacements(
  inputs: readonly JointControlPlacementInput[],
  obstacles: readonly DrawingControlObstacle[] = [],
): ReadonlyMap<string, ControlPlacement> {
  const occupied: DrawingControlObstacle[] = [...obstacles];
  const placements = new Map<string, ControlPlacement>();

  for (const input of inputs) {
    const placement = chooseAvailableControlPlacement(
      input.candidates,
      [...occupied, ...(input.obstacles ?? [])],
    );
    if (!placement) continue;
    placements.set(input.id, placement);
    occupied.push({ ...placement.rect, id: `text-control-${input.id}` });
  }

  return placements;
}


export type TextCardGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: TextCardPoint;
  connectorStart: TextCardPoint;
  connectorEnd: TextCardPoint;
};

export type TextCardGeometryPlacementInput = {
  id: string;
  geometry: TextCardGeometry;
};

export type TextCardGeometryResolution = {
  placements: ReadonlyMap<string, TextCardGeometry>;
  unresolvedIds: readonly string[];
};

const TEXT_HORIZONTAL_PADDING = 4;
// The operation row is laid out below the body. It needs vertical reserve,
// while the body keeps its full horizontal budget. Coarse pointers enlarge
// the row without changing text wrapping.
const TEXT_CARD_CONTROL_WIDTH = 36;
const TEXT_CARD_CONTROL_HEIGHT = 44;
const TEXT_CARD_COARSE_CONTROL_HEIGHT = 44;
const NO_LINE_START_PUNCTUATION = new Set("，。！？；：、）》」』】〕〉》’”〗〙〛".split(""));

function wrapText(
  value: string,
  width: number,
  measure: (value: string) => number,
) {
  const lines: string[] = [];
  for (const sourceLine of value.split("\n")) {
    let line = "";
    for (const character of Array.from(sourceLine)) {
      const candidate = line + character;
      if (line && measure(candidate) > width) {
        if (NO_LINE_START_PUNCTUATION.has(character)) {
          const lineCharacters = Array.from(line);
          const lastCharacter = lineCharacters.pop();
          const precedingLine = lineCharacters.join("");
          if (lastCharacter && precedingLine && measure(precedingLine + character) <= width) {
            lines.push(precedingLine);
            line = lastCharacter + character;
            continue;
          }
        }
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
  _legacyReserveRight = 0,
  reserveBottom = 0,
  allowFold = false,
): TextCardLayout {
  // Keep the positional argument for existing callers; card controls no
  // longer consume horizontal body space.
  void _legacyReserveRight;
  const full = textLayout(
    value,
    textWidth,
    fontSize,
    maxWidth,
    // Card controls live in the bottom operation row. Keep them out of the
    // body width budget so live paint, hit testing, editor placement, and
    // capture warnings share the same full-width wrapping.
    0,
  );
  // Fold is an explicit normal-card affordance for short cards, while legacy
  // callers retain their historical long-body collapse behavior. A two-line
  // normal card gets a compact one-line summary; longer cards keep the
  // established two-line summary and ellipsis treatment.
  const canExpand = full.lines.length > 2 || (allowFold && full.lines.length > 1);
  const collapsed = canExpand && !expanded;
  const summaryLines = collapsed
    ? full.lines.length === 2
      ? [summaryLine(
          full.lines[0],
          fontSize,
          Math.max(1, full.width - TEXT_HORIZONTAL_PADDING * 2),
        )]
      : full.lines.slice(0, 2).map((line, index, all) =>
          index === all.length - 1
            ? summaryLine(
                line,
                fontSize,
                Math.max(1, full.width - TEXT_HORIZONTAL_PADDING * 2),
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
              Math.max(1, full.width - TEXT_HORIZONTAL_PADDING * 2),
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
    { edge: "left", distance: point.x - x, point: { x, y: point.y } },
    { edge: "right", distance: right - point.x, point: { x: right, y: point.y } },
    { edge: "top", distance: point.y - y, point: { x: point.x, y } },
    { edge: "bottom", distance: bottom - point.y, point: { x: point.x, y: bottom } },
  ] as const;
  const nearest = distances.reduce((candidate, current) =>
    current.distance < candidate.distance ? current : candidate,
  );
  if (nearest.distance > 0) return nearest.point;

  // A card whose position is exactly the anchor can otherwise produce a
  // zero-length connector. Keep the anchor fixed and move only the card-edge
  // endpoint by a small bounded amount. Prefer a horizontal edge for a wider
  // card (and a vertical edge for a taller card) at a corner, which makes the
  // seam deterministic without changing ordinary nearest-edge attachment.
  const zeroEdges = distances.filter((candidate) => candidate.distance === 0);
  const preferredEdges = width >= height
    ? ["top", "bottom", "left", "right"]
    : ["left", "right", "top", "bottom"];
  const edge = preferredEdges.find((candidate) =>
    zeroEdges.some((item) => item.edge === candidate),
  ) ?? nearest.edge;
  const boundary = zeroEdges.find((candidate) => candidate.edge === edge)?.point ?? nearest.point;
  const span = edge === "top" || edge === "bottom" ? width : height;
  const nudge = span > 1 ? Math.min(4, span / 2) : 0;
  if (nudge === 0) return boundary;
  if (edge === "top" || edge === "bottom") {
    const towardRight = right - point.x >= point.x - x;
    return {
      x: point.x + (towardRight ? nudge : -nudge),
      y: boundary.y,
    };
  }
  const towardBottom = bottom - point.y >= point.y - y;
  return {
    x: boundary.x,
    y: point.y + (towardBottom ? nudge : -nudge),
  };
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
  const horizontalSpace = Math.max(0, plotWidth - width);
  const verticalSpace = Math.max(0, plotHeight - height);
  const minX = horizontalSpace >= margin * 2 ? margin : 0;
  const maxX = horizontalSpace >= margin * 2 ? horizontalSpace - margin : horizontalSpace;
  const minY = verticalSpace >= margin * 2 ? margin : 0;
  const maxY = verticalSpace >= margin * 2 ? verticalSpace - margin : verticalSpace;
  const x = Math.max(minX, Math.min(maxX, desired.x));
  const y = Math.max(minY, Math.min(maxY, desired.y));
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

function geometryRect(geometry: Pick<TextCardGeometry, "x" | "y" | "width" | "height">): DrawingControlRect {
  return {
    left: geometry.x,
    top: geometry.y,
    right: geometry.x + geometry.width,
    bottom: geometry.y + geometry.height,
  };
}

function rectsOverlap(left: DrawingControlRect, right: DrawingControlRect) {
  return left.left < right.right && right.left < left.right &&
    left.top < right.bottom && right.top < left.bottom;
}

/**
 * Resolve the readable bodies into one transient plot-local space. This is a
 * layout pass only: width, height, anchor and persisted canvas coordinates
 * stay untouched. A card that cannot fit is reported so its owner can widen
 * the plot rather than hiding its body or making its controls keyboard-only.
 */
export function resolveTextCardGeometries(
  entries: readonly TextCardGeometryPlacementInput[],
  obstacles: readonly DrawingControlObstacle[],
  plotWidth: number,
  plotHeight: number,
  gap = 8,
): TextCardGeometryResolution {
  const placements = new Map<string, TextCardGeometry>();
  const unresolvedIds: string[] = [];
  const placedRects: DrawingControlRect[] = [];
  const ordered = [...entries].sort((left, right) =>
    left.geometry.y - right.geometry.y || left.id.localeCompare(right.id),
  );

  for (const entry of ordered) {
    const { geometry } = entry;
    const candidates = [
      geometry.y,
      4,
      ...obstacles.map((obstacle) => obstacle.bottom + gap),
      ...placedRects.map((rect) => rect.bottom + gap),
    ];
    const candidate = candidates
      .map((y) => textCardGeometry(
        geometry.anchor,
        { x: geometry.x, y },
        { width: geometry.width, height: geometry.height },
        plotWidth,
        plotHeight,
      ))
      .filter((next, index, all) => all.findIndex((other) => other.x === next.x && other.y === next.y) === index)
      .filter((next) => {
        const rect = geometryRect(next);
        return !obstacles.some((obstacle) => rectsOverlap(rect, obstacle)) &&
          !placedRects.some((placed) => rectsOverlap(rect, placed));
      })
      .sort((left, right) =>
        Math.abs(left.y - geometry.y) - Math.abs(right.y - geometry.y) || left.y - right.y,
      )[0];

    if (!candidate) {
      placements.set(entry.id, geometry);
      unresolvedIds.push(entry.id);
      // Keep unresolved cards in the collision set. This reports the full
      // capacity failure and prevents later cards from claiming the same
      // visual surface as if the failed card were absent.
      placedRects.push(geometryRect(geometry));
      continue;
    }
    placements.set(entry.id, candidate);
    placedRects.push(geometryRect(candidate));
  }

  return { placements, unresolvedIds };
}

export const textCardLayoutOptions = {
  controlWidth: TEXT_CARD_CONTROL_WIDTH,
  controlHeight: TEXT_CARD_CONTROL_HEIGHT,
  coarseControlHeight: TEXT_CARD_COARSE_CONTROL_HEIGHT,
  horizontalPadding: TEXT_HORIZONTAL_PADDING,
} as const;
