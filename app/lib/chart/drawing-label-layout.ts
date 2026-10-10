/** CSS-pixel geometry primitives shared by canvas drawing painters. */
export type LabelPoint = { x: number; y: number };
export type LabelRect = { x: number; y: number; width: number; height: number };

export type DrawingLabelRowKind = "ratio" | "price" | "value";

export type DrawingLabelRow = {
  id: string;
  text: string;
  kind?: DrawingLabelRowKind;
  /** The source line's y coordinate, when a row is tied to chart geometry. */
  lineY?: number;
};

export type LabelRowLayout = DrawingLabelRow & {
  lines: string[];
  width: number;
  height: number;
};

export type LabelMeasure = (text: string, fontSize: number) => number;

export type ArrowheadGeometry = {
  tip: LabelPoint;
  baseLeft: LabelPoint;
  baseRight: LabelPoint;
  length: number;
  width: number;
};

export type ArrowheadOptions = {
  /** Maximum length in CSS pixels; short vectors are scaled down. */
  length?: number;
  /** Width across the two rear corners in CSS pixels. */
  width?: number;
};

/**
 * Computes a real vector arrowhead without touching the shaft geometry.
 *
 * The tip is always the supplied end point. Keeping that point exact lets the
 * canvas continue hit-testing and serializing the original two anchors while
 * this helper only paints the directional decoration.
 */
export function arrowheadGeometry(
  start: LabelPoint,
  end: LabelPoint,
  options: ArrowheadOptions = {},
): ArrowheadGeometry | null {
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (!(distance > 0) || !Number.isFinite(distance)) return null;

  const requestedLength = Number.isFinite(options.length)
    ? Math.max(0.1, options.length as number)
    : 10;
  const requestedWidth = Number.isFinite(options.width)
    ? Math.max(0.1, options.width as number)
    : 7;
  const length = Math.min(requestedLength, distance * 0.75);
  const width = requestedWidth;
  const ux = dx / distance;
  const uy = dy / distance;
  const px = -uy;
  const py = ux;
  const baseCenter = {
    x: end.x - ux * length,
    y: end.y - uy * length,
  };
  const halfWidth = width / 2;
  return {
    tip: { x: end.x, y: end.y },
    baseLeft: {
      x: baseCenter.x + px * halfWidth,
      y: baseCenter.y + py * halfWidth,
    },
    baseRight: {
      x: baseCenter.x - px * halfWidth,
      y: baseCenter.y - py * halfWidth,
    },
    length,
    width,
  };
}

export type RiskRewardLabelValues = {
  entry: string;
  stop: string;
  target: string;
  risk: string;
  reward: string;
  ratio: string;
};

/** Keeps the complete six-row RR surface explicit at the call site. */
export function riskRewardLabelRows(values: RiskRewardLabelValues): DrawingLabelRow[] {
  return [
    { id: "entry", text: values.entry, kind: "value" },
    { id: "stop", text: values.stop, kind: "value" },
    { id: "target", text: values.target, kind: "value" },
    { id: "risk", text: values.risk, kind: "value" },
    { id: "reward", text: values.reward, kind: "value" },
    { id: "ratio", text: values.ratio, kind: "value" },
  ];
}

export type FibonacciLabelValue = {
  ratio: number;
  price: number;
  y: number;
};

/** Returns ratio and interpolated-price rows for every supplied fib line. */
export function fibonacciLabelRows(
  levels: readonly FibonacciLabelValue[],
): DrawingLabelRow[] {
  return levels.map((level, index) => {
    const ratioText = Number.isFinite(level.ratio)
      ? `${(level.ratio * 100).toFixed(1)}%`
      : "Invalid ratio";
    const priceText = Number.isFinite(level.price)
      ? level.price.toFixed(2)
      : "Invalid price";
    const lineY = Number.isFinite(level.y) ? level.y : undefined;
    return {
      id: `fib-${index}`,
      text: `${ratioText}  ${priceText}`,
      kind: "value" as const,
      lineY,
    };
  });
}

export type DrawingLabelLayoutInput = {
  rows: readonly DrawingLabelRow[];
  geometryBounds: LabelRect;
  plot: LabelRect;
  measure: LabelMeasure;
  fontSize?: number;
  lineHeight?: number;
  padding?: number;
  gap?: number;
  /** Clearance around an endpoint/handle before a candidate may be placed. */
  endpointClearance?: number;
  /** Maximum label surface width in CSS pixels; defaults to the plot width. */
  maxWidth?: number;
  avoidRects?: readonly LabelRect[];
  endpointTargets?: readonly LabelPoint[];
  priceAxis?: LabelRect;
  leaderTarget?: LabelPoint;
};

export type LabelLeader = { from: LabelPoint; to: LabelPoint };

export type LabelPosition = LabelRect & {
  rows: LabelRowLayout[];
  surface: "surface" | "transparent";
  leader?: LabelLeader;
  overlapArea: number;
  fits: boolean;
  candidateIndex: number;
};

export type DrawingLabelLayout = {
  rows: LabelRowLayout[];
  candidates: LabelPosition[];
  bestPosition: LabelPosition | null;
  nonOverlapping: boolean;
  overflow: { width: boolean; height: boolean };
  fontSize: number;
  lineHeight: number;
  padding: number;
};

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function rect(value: LabelRect): LabelRect {
  return {
    x: finiteOr(value.x, 0),
    y: finiteOr(value.y, 0),
    width: Math.max(0, finiteOr(value.width, 0)),
    height: Math.max(0, finiteOr(value.height, 0)),
  };
}

function overlapArea(left: LabelRect, right: LabelRect) {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) -
      Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) -
      Math.max(left.y, right.y),
  );
  return width * height;
}

function endpointAvoidance(point: LabelPoint, radius: number): LabelRect {
  return { x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2 };
}

function wrapText(value: string, width: number, measure: LabelMeasure, fontSize: number) {
  const source = value.length ? value : "";
  const lines: string[] = [];
  let line = "";
  for (const character of Array.from(source)) {
    const candidate = line + character;
    if (line && measure(candidate, fontSize) > width) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines;
}

function pointOnRect(point: LabelPoint, target: LabelRect): LabelPoint {
  return {
    x: Math.max(target.x, Math.min(target.x + target.width, point.x)),
    y: Math.max(target.y, Math.min(target.y + target.height, point.y)),
  };
}

function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  plot: LabelRect,
) {
  return {
    x: Math.max(plot.x, Math.min(plot.x + Math.max(0, plot.width - width), x)),
    y: Math.max(plot.y, Math.min(plot.y + Math.max(0, plot.height - height), y)),
  };
}

function labelRows(
  rows: readonly DrawingLabelRow[],
  contentWidth: number,
  measure: LabelMeasure,
  fontSize: number,
  lineHeight: number,
): LabelRowLayout[] {
  return rows.map((row) => {
    const lines = wrapText(row.text, contentWidth, measure, fontSize);
    const width = Math.max(
      0,
      ...lines.map((line) => finiteOr(measure(line, fontSize), 0)),
    );
    return {
      ...row,
      lines,
      width,
      height: lines.length * lineHeight,
    };
  });
}

/**
 * Generates deterministic placement candidates, then chooses the least
 * overlapping one. A transparent best position is intentional when a narrow
 * plot has no feasible readable/non-overlapping surface.
 */
export function layoutDrawingLabels(input: DrawingLabelLayoutInput): DrawingLabelLayout {
  const fontSize = Math.max(12, finiteOr(input.fontSize ?? 12, 12));
  const lineHeight = Math.max(18, finiteOr(input.lineHeight ?? 18, 18));
  const padding = Math.max(6, finiteOr(input.padding ?? 6, 6));
  const gap = Math.max(0, finiteOr(input.gap ?? 8, 8));
  // The base gap separates a label from the geometry bounds. Handles are
  // independently interactive hit targets, so candidates need a second
  // clearance band instead of being allowed to touch an endpoint and then
  // falling back to a transparent surface.
  const endpointClearance = Math.max(0, finiteOr(input.endpointClearance ?? 12, 12));
  const handleClearance = Math.max(
    endpointClearance,
    ...(input.avoidRects ?? []).map((item) => {
      const safe = rect(item);
      return Math.max(safe.width, safe.height) / 2;
    }),
  );
  const candidateGap = gap + handleClearance;
  const plot = rect(input.plot);
  const bounds = rect(input.geometryBounds);
  const maxContentWidth = Math.max(
    1,
    Math.min(
      Math.max(1, finiteOr(input.maxWidth ?? plot.width, plot.width) - padding * 2),
      Math.max(1, plot.width - padding * 2),
    ),
  );
  const rows = labelRows(input.rows, maxContentWidth, input.measure, fontSize, lineHeight);
  const measuredWidth = Math.max(1, ...rows.map((row) => row.width));
  const naturalWidth = Math.max(1, measuredWidth + padding * 2);
  const width = Math.min(plot.width, naturalWidth);
  const height = Math.max(1, rows.reduce((sum, row) => sum + row.height, 0) + padding * 2);
  const overflow = {
    width: naturalWidth > plot.width,
    height: height > plot.height,
  };
  const centeredX = bounds.x + (bounds.width - width) / 2;
  const rawCandidates = [
    { x: bounds.x + bounds.width + candidateGap, y: bounds.y },
    { x: bounds.x - width - candidateGap, y: bounds.y },
    { x: centeredX, y: bounds.y - height - candidateGap },
    { x: centeredX, y: bounds.y + bounds.height + candidateGap },
    { x: centeredX, y: bounds.y + (bounds.height - height) / 2 },
    { x: bounds.x + bounds.width + candidateGap, y: bounds.y + bounds.height - height },
    { x: bounds.x - width - candidateGap, y: bounds.y + bounds.height - height },
    { x: bounds.x + bounds.width - width, y: bounds.y - height - candidateGap },
  ];
  const obstacles = [
    bounds,
    ...(input.avoidRects ?? []).map(rect),
    ...(input.endpointTargets ?? []).map((point) => endpointAvoidance(point, endpointClearance)),
    ...(input.priceAxis ? [rect(input.priceAxis)] : []),
  ];
  const candidates: LabelPosition[] = rawCandidates.map((candidate, candidateIndex) => {
    const position = clampPosition(candidate.x, candidate.y, width, height, plot);
    const candidateRect = { ...position, width, height };
    const overlap = obstacles.reduce((sum, obstacle) => sum + overlapArea(candidateRect, obstacle), 0);
    const fits = !overflow.width && !overflow.height;
    const leader = input.leaderTarget
      ? { from: input.leaderTarget, to: pointOnRect(input.leaderTarget, candidateRect) }
      : undefined;
    return {
      ...candidateRect,
      rows: rows.map((row) => ({ ...row, lines: [...row.lines] })),
      surface: "transparent",
      leader,
      overlapArea: overlap,
      fits,
      candidateIndex,
    };
  });
  const best = candidates
    .slice()
    .sort((left, right) =>
      Number(!left.fits) - Number(!right.fits) ||
      left.overlapArea - right.overlapArea ||
      left.candidateIndex - right.candidateIndex,
    )[0] ?? null;

  // When a full-height grouped surface cannot clear a handle, the readable
  // fallback still needs a safe viewport. Split the plot at obstacle edges and
  // choose the largest obstacle-free cell; the DOM fallback can scroll the
  // complete rows inside that cell. This keeps a visible 35px+ corridor for
  // handles instead of selecting a large overlapping rectangle.
  const fallbackCandidate = (() => {
    if (best && best.fits && best.overlapArea === 0) return null;
    const clampX = (value: number) => Math.min(plot.x + plot.width, Math.max(plot.x, value));
    const clampY = (value: number) => Math.min(plot.y + plot.height, Math.max(plot.y, value));
    const xEdges = [...new Set([
      plot.x,
      plot.x + plot.width,
      ...obstacles.flatMap((obstacle) => [clampX(obstacle.x), clampX(obstacle.x + obstacle.width)]),
    ])].sort((left, right) => left - right);
    const yEdges = [...new Set([
      plot.y,
      plot.y + plot.height,
      ...obstacles.flatMap((obstacle) => [clampY(obstacle.y), clampY(obstacle.y + obstacle.height)]),
    ])].sort((top, bottom) => top - bottom);
    const preferred = best ?? {
      x: plot.x,
      y: plot.y,
      width: naturalWidth,
      height,
    };
    const cells: LabelPosition[] = [];
    for (let xIndex = 0; xIndex < xEdges.length - 1; xIndex += 1) {
      for (let yIndex = 0; yIndex < yEdges.length - 1; yIndex += 1) {
        const cell = {
          x: xEdges[xIndex]!,
          y: yEdges[yIndex]!,
          width: Math.max(0, xEdges[xIndex + 1]! - xEdges[xIndex]!),
          height: Math.max(0, yEdges[yIndex + 1]! - yEdges[yIndex]!),
        };
        if (cell.width <= 0 || cell.height <= 0 || obstacles.some((obstacle) => overlapArea(cell, obstacle) > 0)) continue;
        const candidateWidth = Math.min(naturalWidth, cell.width);
        const candidateHeight = Math.min(height, cell.height);
        if (candidateWidth <= 0 || candidateHeight <= 0) continue;
        const x = Math.max(cell.x, Math.min(cell.x + cell.width - candidateWidth, preferred.x));
        const y = Math.max(cell.y, Math.min(cell.y + cell.height - candidateHeight, preferred.y));
        const candidateRect = { x, y, width: candidateWidth, height: candidateHeight };
        if (obstacles.some((obstacle) => overlapArea(candidateRect, obstacle) > 0)) continue;
        cells.push({
          ...candidateRect,
          rows: rows.map((row) => ({ ...row, lines: [...row.lines] })),
          surface: "transparent",
          leader: input.leaderTarget
            ? { from: input.leaderTarget, to: pointOnRect(input.leaderTarget, candidateRect) }
            : undefined,
          overlapArea: 0,
          fits: false,
          candidateIndex: 10000 + cells.length,
        });
      }
    }
    return cells
      .filter((candidate) => candidate.width >= 35 && candidate.height >= 35)
      .sort((left, right) =>
        right.width * right.height - left.width * left.height ||
        Math.abs(left.x - preferred.x) + Math.abs(left.y - preferred.y) -
          (Math.abs(right.x - preferred.x) + Math.abs(right.y - preferred.y)),
      )[0] ?? null;
  })();
  const selected = fallbackCandidate ?? best;
  if (selected) {
    selected.surface = selected.fits && selected.overlapArea === 0 ? "surface" : "transparent";
  }
  return {
    rows,
    candidates,
    bestPosition: selected,
    nonOverlapping: Boolean(selected && selected.fits && selected.overlapArea === 0),
    overflow,
    fontSize,
    lineHeight,
    padding,
  };
}
