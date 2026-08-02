import { Temporal } from "@js-temporal/polyfill";

export type WallClockResult =
  | { ok: true; executedAt: string }
  | {
      ok: false;
      code:
        | "invalid-wall-clock"
        | "nonexistent-wall-clock"
        | "ambiguous-wall-clock";
    };

const WALL_CLOCK_PATTERN =
  /^(\d{2}|\d{4})([/-])(\d{2})\2(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

function normalizeWallClockSourceText(sourceText: string): string {
  return sourceText
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*([/:-])\s*/g, "$1");
}

export function wallClockToInstant(
  sourceText: string,
  timeZone: string,
  disambiguation?: "earlier" | "later",
): WallClockResult {
  const match = WALL_CLOCK_PATTERN.exec(
    normalizeWallClockSourceText(sourceText),
  );
  if (!match) {
    return { ok: false, code: "invalid-wall-clock" };
  }

  const sourceYear = Number(match[1]);
  const fields = {
    year: match[1].length === 2 ? 2000 + sourceYear : sourceYear,
    month: Number(match[3]),
    day: Number(match[4]),
    hour: Number(match[5]),
    minute: Number(match[6]),
    second: Number(match[7]),
  };

  try {
    const wallClock = Temporal.PlainDateTime.from(fields, {
      overflow: "reject",
    });
    const zonedFields = { ...fields, timeZone };
    const earlier = Temporal.ZonedDateTime.from(zonedFields, {
      disambiguation: "earlier",
      overflow: "reject",
    });
    const later = Temporal.ZonedDateTime.from(zonedFields, {
      disambiguation: "later",
      overflow: "reject",
    });
    const earlierMatches = earlier.toPlainDateTime().equals(wallClock);
    const laterMatches = later.toPlainDateTime().equals(wallClock);

    if (!earlierMatches || !laterMatches) {
      return { ok: false, code: "nonexistent-wall-clock" };
    }

    const repeated = !earlier.toInstant().equals(later.toInstant());
    if (repeated && disambiguation === undefined) {
      return { ok: false, code: "ambiguous-wall-clock" };
    }

    const resolved = disambiguation === "later" ? later : earlier;
    return {
      ok: true,
      executedAt: resolved
        .toInstant()
        .toString({ smallestUnit: "second" }),
    };
  } catch {
    return { ok: false, code: "invalid-wall-clock" };
  }
}
