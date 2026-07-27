const CURSOR_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatReplayCursor(timestamp: string) {
  const parts = Object.fromEntries(
    CURSOR_FORMATTER.formatToParts(new Date(timestamp)).map((part) => [
      part.type,
      part.value,
    ]),
  );
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}
