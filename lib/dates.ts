/**
 * Returns the local wall-clock time in `timezone` for a given UTC instant.
 * Uses Intl.DateTimeFormat's `formatToParts` — always available in Node 20+.
 */
export function localParts(
  at: Date,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number; isoDate: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  let hour = Number(map.hour);
  if (hour === 24) hour = 0; // Intl emits "24" for midnight in some locales
  const minute = Number(map.minute);
  const isoDate = `${map.year}-${map.month}-${map.day}`;
  return { year, month, day, hour, minute, isoDate };
}

/**
 * Returns true if `timezone` is a valid IANA zone per the host's ICU database.
 * Unknown zones throw on `formatToParts`; we catch and report.
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function relativeTime(at: Date, now: Date = new Date()): string {
  const diff = now.getTime() - at.getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.round(mo / 12);
  return `${y}y ago`;
}
