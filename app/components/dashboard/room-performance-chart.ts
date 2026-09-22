export type ChartValue = { value: string | null };

export type ChartDomain = {
  min: number;
  max: number;
};

export type ChartGeometry = {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  plotWidth: number;
  plotHeight: number;
};

export type ChartPointCoordinate = {
  index: number;
  x: number;
  y: number;
  value: string;
};

export type ChartAxisLabel = {
  index: number;
  key: string;
  label: string;
  x: number;
};

const DEFAULT_GEOMETRY = {
  width: 640,
  height: 220,
  padding: { top: 14, right: 18, bottom: 34, left: 58 },
} as const;

type ChartPaddingOptions = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type ChartGeometryOptions = {
  width?: number;
  height?: number;
  padding?: ChartPaddingOptions;
};

export function createChartGeometry(
  options: ChartGeometryOptions = {},
): ChartGeometry {
  const padding = { ...DEFAULT_GEOMETRY.padding, ...options.padding };
  const width = options.width ?? DEFAULT_GEOMETRY.width;
  const height = options.height ?? DEFAULT_GEOMETRY.height;
  return {
    width,
    height,
    padding,
    plotWidth: Math.max(1, width - padding.left - padding.right),
    plotHeight: Math.max(1, height - padding.top - padding.bottom),
  };
}

export function valueDomain(values: readonly (string | null)[]): ChartDomain {
  const numbers = values
    .filter((value): value is string => value !== null)
    .map(Number)
    .filter(Number.isFinite);
  return { min: Math.min(0, ...numbers), max: Math.max(0, ...numbers) };
}

function valueSpan(domain: ChartDomain): number {
  return domain.max - domain.min || 1;
}

export function chartX(index: number, count: number, geometry: ChartGeometry): number {
  const ratio = count <= 1 ? 0.5 : index / (count - 1);
  return geometry.padding.left + ratio * geometry.plotWidth;
}

export function chartY(value: number, domain: ChartDomain, geometry: ChartGeometry): number {
  return geometry.padding.top + geometry.plotHeight - ((value - domain.min) / valueSpan(domain)) * geometry.plotHeight;
}

export function chartPointCoordinates(
  points: readonly ChartValue[],
  geometry: ChartGeometry,
  domain: ChartDomain,
): ChartPointCoordinate[] {
  return points.flatMap((point, index) => {
    if (point.value === null || !Number.isFinite(Number(point.value))) return [];
    return [{
      index,
      x: chartX(index, points.length, geometry),
      y: chartY(Number(point.value), domain, geometry),
      value: point.value,
    }];
  });
}

export function chartLinePath(
  points: readonly ChartValue[],
  geometry: ChartGeometry,
  domain: ChartDomain,
): string {
  let path = "";
  let connected = false;
  points.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(Number(point.value))) {
      connected = false;
      return;
    }
    const coordinate = `${chartX(index, points.length, geometry).toFixed(2)},${chartY(Number(point.value), domain, geometry).toFixed(2)}`;
    path += `${connected ? " L" : "M"}${coordinate}`;
    connected = true;
  });
  return path;
}

export function chartZeroY(domain: ChartDomain, geometry: ChartGeometry): number {
  return chartY(0, domain, geometry);
}

export function chartAxisLabels(
  points: readonly { key: string; label: string }[],
  geometry: ChartGeometry,
  maxLabels = 4,
): ChartAxisLabel[] {
  if (points.length === 0) return [];
  const step = Math.max(1, Math.ceil((points.length - 1) / Math.max(1, maxLabels - 1)));
  return points
    .map((point, index) => ({ point, index }))
    .filter(({ index }) => index === 0 || index === points.length - 1 || index % step === 0)
    .map(({ point, index }) => ({
      index,
      key: point.key,
      label: point.label,
      x: chartX(index, points.length, geometry),
    }));
}

export function chartAxisTicks(domain: ChartDomain, geometry: ChartGeometry): Array<{ value: number; y: number }> {
  const values = [...new Set([domain.max, 0, domain.min])];
  return values.map(value => ({ value, y: chartY(value, domain, geometry) }));
}
