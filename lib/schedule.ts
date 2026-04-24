import { createHash } from "crypto";

const HOUR_MIN = 9;
const HOUR_MAX_EXCLUSIVE = 22;

/**
 * mulberry32: tiny deterministic PRNG. Seeded once per (installation, day), so
 * the same installation always derives the same plan for the same local date,
 * which is what makes scheduling stateless.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(installationId: string, isoDate: string): number {
  const h = createHash("sha256").update(`${installationId}|${isoDate}`).digest();
  return h.readUInt32BE(0);
}

export type DailyPlan = {
  /** Sorted ascending list of local hours (9..21 inclusive) the bot should commit at. */
  hours: number[];
  /** Total commits planned for the day. */
  count: number;
};

export function dailyPlan(
  installationId: string,
  isoDate: string,
  cadenceMin: number,
  cadenceMax: number,
): DailyPlan {
  const rand = mulberry32(seedFor(installationId, isoDate));

  const min = Math.max(1, Math.floor(cadenceMin));
  const max = Math.max(min, Math.floor(cadenceMax));
  const span = max - min + 1;
  const count = min + Math.floor(rand() * span);

  const windowSize = HOUR_MAX_EXCLUSIVE - HOUR_MIN; // 13 hours: 9..21 inclusive
  const hours = new Set<number>();
  const target = Math.min(count, windowSize);
  // Reservoir-y sampling — keep pulling until we have `target` distinct hours.
  while (hours.size < target) {
    hours.add(HOUR_MIN + Math.floor(rand() * windowSize));
  }

  return { hours: [...hours].sort((a, b) => a - b), count: target };
}

/** True if `localHour` falls inside the business window (9..21 inclusive). */
export function inWindow(localHour: number): boolean {
  return localHour >= HOUR_MIN && localHour < HOUR_MAX_EXCLUSIVE;
}

/**
 * Given the plan and the current local hour, returns the next planned hour
 * that's strictly in the future (today), or null if none remain today.
 */
export function nextPlannedHour(plan: DailyPlan, localHour: number): number | null {
  for (const h of plan.hours) if (h > localHour) return h;
  return null;
}
