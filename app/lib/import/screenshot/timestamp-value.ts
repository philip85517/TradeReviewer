import type { OcrTextLine } from "./contracts";

export type TimestampValueSelection = {
  value: string;
  lines: readonly OcrTextLine[];
};

export function selectTimestampValue(
  lines: readonly OcrTextLine[],
): TimestampValueSelection | undefined {
  if (lines.length === 0) return undefined;
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
        (time) => time.line.sourceBounds.y >= date.line.sourceBounds.y,
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
    return {
      value:
        closestPair.date.line === closestPair.time.line
          ? closestPair.date.text
          : `${closestPair.date.text} ${closestPair.time.text}`,
      lines: selectedLines,
    };
  }

  return {
    value: normalizedLines.map(({ text }) => text).join(" "),
    lines,
  };
}
