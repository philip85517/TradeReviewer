export type TextFontSize = 12 | 14 | 16 | 18 | 24 | 32;

export type TextLayout = {
  width: number;
  lineHeight: number;
  lines: string[];
  height: number;
};

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
): TextLayout {
  const width = Math.min(
    Math.max(1, maxWidth),
    Math.max(36, Number.isFinite(textWidth) ? textWidth : 180),
  );
  const lineHeight = Math.round(fontSize * 1.5);
  const averageCharacterWidth = Math.max(1, fontSize * 0.72);
  const lines = wrapText(
    value,
    Math.max(1, width - 12),
    (candidate) => Array.from(candidate).length * averageCharacterWidth,
  );
  return {
    width,
    lineHeight,
    lines,
    height: Math.max(lineHeight, lines.length * lineHeight) + 8,
  };
}
