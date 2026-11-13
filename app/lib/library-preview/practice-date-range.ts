export type PracticeDateRange = { from: string; to: string };
export type PracticeDatePreset = "all" | "week" | "month" | "year";

export function getShanghaiDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

export function presetRange(preset: PracticeDatePreset, now: Date): PracticeDateRange {
  if (preset === "all") return { from: "", to: "" };
  const to = getShanghaiDate(now);
  if (preset === "year") return { from: `${to.slice(0, 4)}-01-01`, to };
  if (preset === "month") return { from: `${to.slice(0, 7)}-01`, to };
  const date = new Date(`${to}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return { from: date.toISOString().slice(0, 10), to };
}

function isDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function validateDateRange(range: PracticeDateRange): string | null {
  if (!range.from && !range.to) return null;
  if (!range.from || !range.to) return "请填写完整日期范围";
  if (!isDate(range.from) || !isDate(range.to)) return "请输入有效日期";
  if (range.from > range.to) return "开始日期不能晚于结束日期";
  return null;
}
