/**
 * Live trading-session clock.
 *
 * The schedule lives with the strategy rules (Rules & Notes) so the dashboard
 * follows whatever window the strategy actually defines, rather than hardcoding
 * 16:00-19:00.
 */

export interface SessionSchedule {
  tradingDays: number[]; // 0=Sun … 6=Sat
  preAlertMinutes: number; // heads-up before the session opens
  sessionStart: string; // "16:00" — entry window opens
  entryWindowClose: string; // "19:00" — no new entries after this
  marketClose: string; // "23:05" — broker flattens
}

export const defaultSchedule: SessionSchedule = {
  tradingDays: [1, 2, 3, 4, 5],
  preAlertMinutes: 30,
  sessionStart: "16:00",
  entryWindowClose: "19:00",
  marketClose: "23:05",
};

/**
 * off      — not a trading day, or too early to care
 * pre      — inside the heads-up window before the open
 * live     — entry window open; new trades allowed
 * holding  — entry window shut, positions may still run to the flat
 * closed   — past the flat for today
 */
export type SessionPhase = "off" | "pre" | "live" | "holding" | "closed";

export type AlertKind = "pre" | "entryClose" | "marketClose";

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

export function isTradingDay(now: Date, s: SessionSchedule): boolean {
  return s.tradingDays.includes(now.getDay());
}

export function sessionPhase(now: Date, s: SessionSchedule): SessionPhase {
  if (!isTradingDay(now, s)) return "off";

  const mins = minutesNow(now);
  const start = toMinutes(s.sessionStart);
  const entryClose = toMinutes(s.entryWindowClose);
  const close = toMinutes(s.marketClose);

  if (mins < start - s.preAlertMinutes) return "off";
  if (mins < start) return "pre";
  if (mins < entryClose) return "live";
  if (mins < close) return "holding";
  return "closed";
}

/** Wall-clock time of an alert on the given day, or null if not a trading day. */
export function alertTime(now: Date, s: SessionSchedule, kind: AlertKind): Date | null {
  if (!isTradingDay(now, s)) return null;
  const minutes =
    kind === "pre"
      ? toMinutes(s.sessionStart) - s.preAlertMinutes
      : kind === "entryClose"
        ? toMinutes(s.entryWindowClose)
        : toMinutes(s.marketClose);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setMinutes(minutes);
  return d;
}

/** The next milestone to count down to, with a label for the widget. */
export function nextMilestone(
  now: Date,
  s: SessionSchedule,
): { label: string; at: Date } | null {
  if (!isTradingDay(now, s)) return null;

  const mins = minutesNow(now);
  const mk = (minutes: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setMinutes(minutes);
    return d;
  };

  const start = toMinutes(s.sessionStart);
  const entryClose = toMinutes(s.entryWindowClose);
  const close = toMinutes(s.marketClose);

  if (mins < start) return { label: "Session opens", at: mk(start) };
  if (mins < entryClose) return { label: "Entry window closes", at: mk(entryClose) };
  if (mins < close) return { label: "Market closes", at: mk(close) };
  return null;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export const PHASE_LABEL: Record<SessionPhase, string> = {
  off: "Closed",
  pre: "Starting soon",
  live: "Live",
  holding: "Holding",
  closed: "Closed",
};

/**
 * Visual weight of the live panel.
 *
 * An entered trade stays "active" past the entry window — the position is
 * still running to the flat, so it remains the thing that matters. Everything
 * else goes quiet once the window shuts.
 */
export type LiveTone = "active" | "pre" | "idle";

export function liveTone(phase: SessionPhase, tradeState: "pending" | "entered" | "none"): LiveTone {
  if (tradeState === "none") return "idle";
  if (tradeState === "entered") return phase === "off" ? "idle" : "active";
  if (phase === "live") return "active";
  if (phase === "pre") return "pre";
  return "idle";
}

/** Has the entry window for the given date already closed? */
export function sessionConcluded(dateStr: string, now: Date, s: SessionSchedule): boolean {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  return minutesNow(now) >= toMinutes(s.entryWindowClose);
}
