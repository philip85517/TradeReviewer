import type { OcrTextLine } from "./contracts";

export type TimestampValueSelection = {
  normalizedValue: string;
  rawText: string;
  lines: readonly OcrTextLine[];
};

function joinLineText(
  lines: readonly OcrTextLine[],
  text: (line: OcrTextLine) => string,
): string {
  return lines.map(text).join(" ");
}

type NormalizedTimestampLine = {
  line: OcrTextLine;
  text: string;
};

type TimestampPair = {
  date: NormalizedTimestampLine;
  time: NormalizedTimestampLine;
  distance: number;
};

function lineCenterY(line: OcrTextLine): number {
  return line.sourceBounds.y + line.sourceBounds.height / 2;
}

function timestampPair(
  date: NormalizedTimestampLine,
  time: NormalizedTimestampLine,
): TimestampPair {
  return {
    date,
    time,
    distance: Math.abs(lineCenterY(date.line) - lineCenterY(time.line)),
  };
}

function orderedTimestampPairs(
  dateLines: readonly NormalizedTimestampLine[],
  timeLines: readonly NormalizedTimestampLine[],
): TimestampPair[] {
  const dates = [...dateLines].sort(
    (left, right) => lineCenterY(left.line) - lineCenterY(right.line),
  );
  const times = [...timeLines].sort(
    (left, right) => lineCenterY(left.line) - lineCenterY(right.line),
  );
  const primary = dates.length <= times.length ? dates : times;
  const secondary = dates.length <= times.length ? times : dates;
  const primaryIsDate = dates.length <= times.length;
  let previous = secondary.map(() => ({
    cost: 0,
    pairs: [] as TimestampPair[],
  }));
  previous.push({ cost: 0, pairs: [] });

  for (let primaryIndex = 0; primaryIndex < primary.length; primaryIndex += 1) {
    const current: Array<
      { cost: number; pairs: TimestampPair[] } | undefined
    > = [undefined];
    for (
      let secondaryCount = 1;
      secondaryCount <= secondary.length;
      secondaryCount += 1
    ) {
      const skipped = current[secondaryCount - 1];
      const prior = previous[secondaryCount - 1];
      const paired = primaryIsDate
        ? timestampPair(
            primary[primaryIndex],
            secondary[secondaryCount - 1],
          )
        : timestampPair(
            secondary[secondaryCount - 1],
            primary[primaryIndex],
          );
      const matched = prior
        ? {
            cost: prior.cost + paired.distance,
            pairs: [...prior.pairs, paired],
          }
        : undefined;
      current.push(
        !skipped || (matched && matched.cost < skipped.cost)
          ? matched
          : skipped,
      );
    }
    previous = current.map(
      (entry) => entry ?? { cost: Number.POSITIVE_INFINITY, pairs: [] },
    );
  }

  return previous[secondary.length]?.pairs ?? [];
}

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
  const timestampPairs = orderedTimestampPairs(dateLines, timeLines);
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
      normalizedValue:
        closestPair.date.line === closestPair.time.line
          ? closestPair.date.text
          : `${closestPair.date.text} ${closestPair.time.text}`,
      rawText: joinLineText(selectedLines, (line) => line.text.trim()),
      lines: selectedLines,
    };
  }

  return {
    normalizedValue: normalizedLines.map(({ text }) => text).join(" "),
    rawText: joinLineText(lines, (line) => line.text.trim()),
    lines,
  };
}
