import { CANVAS_TEXT_FONT_FAMILY } from "./text-geometry";

export const PLAN_AXIS_COLORS = {
  entry: "#adbbcf",
  stop: "#b6a1e8",
  target: "#f3ba2f",
  mixed: "#dbe5f3",
} as const;

export type PlanAxisRole = keyof typeof PLAN_AXIS_COLORS;

export type PlanAxisLine = {
  id: string;
  price: number;
  title: string;
  displayPrice?: string | null;
};

export type PlanAxisMappedLine = PlanAxisLine & {
  /** The chart coordinate for the real price. This value is never displaced. */
  trueY: number | null;
};

export type PlanAxisBounds = {
  plotRight: number;
  axisRight: number;
  top: number;
  bottom: number;
  lineHeight: number;
  gap?: number;
  /** Minimum center-to-center spacing for live pointer hit rows. */
  rowClearance?: number;
  /** Native SDK price labels which the outside text must keep clear. */
  obstacleYs?: readonly number[];
};

export type PlanAxisLabelPart = {
  id: string;
  title: string;
  displayPrice: string;
  color: string;
};

export type PlanAxisLabel = {
  key: string;
  sourceIds: string[];
  parts: PlanAxisLabelPart[];
  text: string;
  /** Complete semantic columns used by live and canonical renderers. */
  nameText: string;
  valueText: string;
  role: PlanAxisRole;
  color: string;
  price: number;
  trueY: number | null;
  /** The y used for the outside text; connectorY remains the real price. */
  labelY: number;
  connectorY: number | null;
  rect: { x: number; y: number; width: number; height: number };
  offscreen: boolean;
  /** False only when the requested spacing cannot fit in the bounded axis. */
  layoutFeasible: boolean;
  /** Measured name/value columns plus separators and the axis gutter. */
  nameWidth: number;
  valueWidth: number;
  contentWidth: number;
  neededAxisWidth: number;
};

export const PLAN_AXIS_GUTTER = 8;
export const PLAN_AXIS_COLUMN_GAP = 8;
export const PLAN_AXIS_TEXT_SIZE = 12;
export const PLAN_AXIS_TEXT_WEIGHT = 400;
export const PLAN_AXIS_TEXT_LINE_HEIGHT = 18;
export const PLAN_AXIS_TEXT_FONT_FAMILY = CANVAS_TEXT_FONT_FAMILY;
export const PLAN_AXIS_TEXT_FONT = `${PLAN_AXIS_TEXT_WEIGHT} ${PLAN_AXIS_TEXT_SIZE}px ${PLAN_AXIS_TEXT_FONT_FAMILY}`;

export type PlanAxisLineOptions = {
  price: number;
  title: "";
  color: string;
  lineWidth: 1;
  lineStyle: 2;
  axisLabelVisible: false;
};

function normalizedText(value: string) {
  return value.trim();
}

export function planAxisRole(line: Pick<PlanAxisLine, "id" | "title">): PlanAxisRole {
  const value = `${line.id} ${line.title}`.toLocaleLowerCase();
  if (/(stop|止损|风险)/u.test(value)) return "stop";
  if (/(target|take.?profit|止盈|目标)/u.test(value)) return "target";
  if (/(entry|cost|入场|成本)/u.test(value)) return "entry";
  return "mixed";
}

export function planAxisColor(line: Pick<PlanAxisLine, "id" | "title">) {
  return PLAN_AXIS_COLORS[planAxisRole(line)];
}

export function planAxisLineOptions(line: PlanAxisLine): PlanAxisLineOptions {
  return {
    price: line.price,
    title: "",
    color: planAxisColor(line),
    lineWidth: 1,
    lineStyle: 2,
    axisLabelVisible: false,
  };
}

function lineDisplayPrice(line: PlanAxisLine) {
  return normalizedText(line.displayPrice ?? String(line.price));
}

function groupKey(line: PlanAxisMappedLine) {
  return Number.isFinite(line.price) ? String(line.price) : `invalid:${line.id}`;
}

/**
 * Produce the semantic outside-axis labels used by both the interactive chart
 * and canonical capture. Price coordinates are supplied by each renderer;
 * layout may move text to avoid collisions but never moves the connector.
 */
export function layoutPlanAxisLabels(
  lines: readonly PlanAxisMappedLine[],
  bounds: PlanAxisBounds,
  measureText: (text: string) => number,
): PlanAxisLabel[] {
  const groups = new Map<string, PlanAxisMappedLine[]>();
  for (const line of lines) {
    if (!Number.isFinite(line.price) || line.price <= 0) continue;
    const key = groupKey(line);
    const group = groups.get(key);
    if (group) group.push(line);
    else groups.set(key, [line]);
  }

  const gap = Math.max(0, bounds.gap ?? 4);
  // The visual row is fixed to the SDK axis metric. Hit targets are owned by
  // ReplayChart and may be larger for the current pointer modality.
  const lineHeight = PLAN_AXIS_TEXT_LINE_HEIGHT;
  const halfHeight = lineHeight / 2;
  const minY = bounds.top + halfHeight;
  const maxY = Math.max(minY, bounds.bottom - halfHeight);
  const measuredLabels = [...groups.values()].map((group, index) => {
    const first = group[0];
    const parts = group.map(line => ({
      id: line.id,
      title: normalizedText(line.title),
      displayPrice: lineDisplayPrice(line),
      color: planAxisColor(line),
    }));
    const separator = " · ";
    const text = parts.map(part => `${part.title} ${part.displayPrice}`.trim()).join(separator);
    const nameText = parts.map(part => part.title).join(" / ");
    const valueText = parts.map(part => part.displayPrice).join(" / ");
    const nameWidth = Math.max(1, measureText(nameText));
    const valueWidth = Math.max(1, measureText(valueText));
    const contentWidth = Math.max(1, measureText(text), nameWidth + PLAN_AXIS_COLUMN_GAP + valueWidth);
    const trueY = group.every(line => line.trueY === group[0].trueY) ? group[0].trueY : group[0].trueY;
    const offscreen = trueY == null || trueY < bounds.top || trueY > bounds.bottom;
    const roleValues = new Set(group.map(planAxisRole));
    const role = roleValues.size === 1 ? [...roleValues][0] : "mixed";
    const center = trueY == null || !Number.isFinite(trueY) ? minY : Math.min(maxY, Math.max(minY, trueY));
    return {
      key: `${groupKey(first)}:${index}`,
      sourceIds: group.map(line => line.id),
      parts,
      text,
      nameText,
      valueText,
      role,
      color: PLAN_AXIS_COLORS[role],
      price: first.price,
      trueY,
      labelY: center,
      connectorY: trueY,
      rect: {
        x: 0,
        y: center - halfHeight,
        width: 0,
        height: lineHeight,
      },
      offscreen,
      layoutFeasible: true as boolean,
      nameWidth,
      valueWidth,
      contentWidth,
      neededAxisWidth: 0,
    } satisfies PlanAxisLabel;
  });

  // Use one budget for every visible row so both renderers share a stable
  // left name boundary and right value boundary across the axis.
  const visibleLabels = measuredLabels.filter(label => !label.offscreen);
  const budgetLabels = visibleLabels.length > 0 ? visibleLabels : measuredLabels;
  const sharedNameWidth = Math.max(1, ...budgetLabels.map(label => label.nameWidth));
  const sharedValueWidth = Math.max(1, ...budgetLabels.map(label => label.valueWidth));
  const sharedContentWidth = Math.max(
    1,
    ...budgetLabels.map(label => label.contentWidth),
    sharedNameWidth + PLAN_AXIS_COLUMN_GAP + sharedValueWidth,
  );
  const sharedNeededAxisWidth = Math.max(1, Math.ceil(sharedContentWidth + PLAN_AXIS_GUTTER));
  const labels = measuredLabels.map(label => ({
    ...label,
    nameWidth: sharedNameWidth,
    valueWidth: sharedValueWidth,
    contentWidth: sharedContentWidth,
    neededAxisWidth: sharedNeededAxisWidth,
    rect: {
      ...label.rect,
      x: Math.max(bounds.plotRight + 4, bounds.axisRight - sharedNeededAxisWidth),
      width: sharedNeededAxisWidth,
    },
  }));

  labels.sort((a, b) => a.labelY - b.labelY);
  const obstacles = (bounds.obstacleYs ?? []).filter(y => Number.isFinite(y));
  const visualClearance = lineHeight + gap;
  const rowClearance = Math.max(visualClearance, bounds.rowClearance ?? visualClearance);
  const allowedRanges: Array<[number, number]> = [];
  let rangeStart = minY;
  for (const obstacleY of [...obstacles].sort((first, second) => first - second)) {
    const forbiddenStart = obstacleY - visualClearance;
    const forbiddenEnd = obstacleY + visualClearance;
    if (forbiddenEnd < minY || forbiddenStart > maxY) continue;
    if (forbiddenStart > rangeStart) {
      allowedRanges.push([rangeStart, Math.min(maxY, forbiddenStart)]);
    }
    rangeStart = Math.max(rangeStart, forbiddenEnd);
    if (rangeStart > maxY) break;
  }
  if (rangeStart <= maxY) allowedRanges.push([rangeStart, maxY]);

  const nearestAllowed = (preferred: number, lower: number, upper: number) => {
    if (lower > upper) return null;
    let best: number | null = null;
    for (const [rangeLower, rangeUpper] of allowedRanges) {
      const candidateLower = Math.max(lower, rangeLower);
      const candidateUpper = Math.min(upper, rangeUpper);
      if (candidateLower > candidateUpper) continue;
      const candidate = Math.max(candidateLower, Math.min(candidateUpper, preferred));
      if (best == null || Math.abs(candidate - preferred) < Math.abs(best - preferred)) best = candidate;
    }
    return best;
  };
  const firstAllowed = (lower: number) => {
    for (const [rangeLower, rangeUpper] of allowedRanges) {
      const candidate = Math.max(lower, rangeLower);
      if (candidate <= rangeUpper) return candidate;
    }
    return null;
  };
  const lastAllowed = (upper: number) => {
    for (let index = allowedRanges.length - 1; index >= 0; index -= 1) {
      const [rangeLower, rangeUpper] = allowedRanges[index];
      const candidate = Math.min(upper, rangeUpper);
      if (candidate >= rangeLower) return candidate;
    }
    return null;
  };
  const preferredY = labels.map(label => label.labelY);
  const placeGlobally = () => {
    const earliest: number[] = [];
    let lower = minY;
    for (let index = 0; index < labels.length; index += 1) {
      const candidate = firstAllowed(lower);
      if (candidate == null) return null;
      earliest.push(candidate);
      lower = candidate + rowClearance;
    }

    const latest = Array<number>(labels.length);
    let upper = maxY;
    for (let index = labels.length - 1; index >= 0; index -= 1) {
      const candidate = lastAllowed(upper);
      if (candidate == null) return null;
      latest[index] = candidate;
      upper = candidate - rowClearance;
    }
    if (earliest.some((candidate, index) => candidate > latest[index])) return null;

    const positions: number[] = [];
    lower = minY;
    for (let index = 0; index < labels.length; index += 1) {
      const candidate = nearestAllowed(preferredY[index], lower, latest[index]);
      if (candidate == null) return null;
      positions.push(candidate);
      lower = candidate + rowClearance;
    }
    return positions;
  };

  // Establish earliest and latest feasible chains before optimizing preferred
  // positions. A local nearest choice can reject a cluster even when a global
  // chain exists; the bounds above reserve enough room for every later row.
  const positions = placeGlobally();
  const layoutFeasible = positions != null;
  if (positions) {
    labels.forEach((label, index) => { label.labelY = positions[index]; });
  } else {
    labels.forEach((label, index) => { label.labelY = preferredY[index]; });
  }
  labels.forEach(label => { label.layoutFeasible = layoutFeasible; });
  for (const label of labels) label.rect.y = label.labelY - halfHeight;
  return labels;
}
