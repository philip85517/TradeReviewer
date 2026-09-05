const BEIJING_TIME_ZONE = "Asia/Shanghai";

const BEIJING_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const BEIJING_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: BEIJING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function partsFor(
  formatter: Intl.DateTimeFormat,
  timestamp: string,
) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [
      part.type,
      part.value,
    ]),
  );
  return parts;
}

export function formatBeijingDateTime(timestamp: string) {
  const parts = partsFor(BEIJING_FORMATTER, timestamp);
  if (!parts) return "时间未知";
  return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatBeijingUnixSeconds(timestamp: number) {
  if (!Number.isFinite(timestamp)) return "时间未知";
  return formatBeijingDateTime(new Date(timestamp * 1000).toISOString());
}

export function formatBeijingDate(timestamp: string) {
  const parts = partsFor(BEIJING_DATE_FORMATTER, timestamp);
  if (!parts) return "日期未知";
  return `${parts.year}年${parts.month}月${parts.day}日`;
}

export function formatReplayCursor(timestamp: string) {
  return formatBeijingDateTime(timestamp);
}
