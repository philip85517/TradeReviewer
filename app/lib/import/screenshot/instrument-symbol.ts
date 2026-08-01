import type { OcrTextLine } from "./contracts";

const ALPHABETIC_TICKER = /^[A-Z][A-Z0-9.-]{0,9}$/;

export function probableAlphabeticTickerLine(
  instrumentLines: readonly OcrTextLine[],
): OcrTextLine | undefined {
  if (instrumentLines.length < 2) return undefined;

  const candidates = instrumentLines.filter((line) =>
    ALPHABETIC_TICKER.test(line.text.trim()),
  );
  if (candidates.length !== 1) return undefined;

  const candidate = candidates[0];
  const precedingLines = instrumentLines.slice(0, -1);
  if (
    candidate !== instrumentLines.at(-1) ||
    precedingLines.some(
      (line) =>
        line.sourceBounds.y + line.sourceBounds.height >
        candidate.sourceBounds.y,
    )
  ) {
    return undefined;
  }

  return candidate;
}
