/**
 * Decides whether to nag about an unlogged session.
 *
 * Only concluded sessions count: today qualifies once the entry window has
 * closed, otherwise the most recent weekday does. Weekends and days already
 * reviewed are skipped, and a dismissal is remembered per-date so the prompt
 * appears at most once a day.
 */

export const SESSION_END_HOUR = 19; // entry window closes 19:00 IL

const DISMISS_KEY = "trading-dashboard-reminder-dismissed";

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/**
 * The most recent trading day whose session has finished, or null if none is
 * within reach (only ever looks back a week).
 */
export function lastConcludedSession(now: Date, sessionEndHour = SESSION_END_HOUR): string | null {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todayQualifies = isWeekday(now) && now.getHours() >= sessionEndHour;
  if (!todayQualifies) cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 7; i++) {
    if (isWeekday(cursor)) return fmt(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return null;
}

/** The date to prompt about, or null when nothing is outstanding. */
export function sessionNeedingReview(
  now: Date,
  reviewedDates: Iterable<string>,
  dismissedDate: string | null,
  sessionEndHour = SESSION_END_HOUR,
): string | null {
  const candidate = lastConcludedSession(now, sessionEndHour);
  if (!candidate) return null;
  if (candidate === dismissedDate) return null;
  if (new Set(reviewedDates).has(candidate)) return null;
  return candidate;
}

export function loadDismissed(): string | null {
  return localStorage.getItem(DISMISS_KEY);
}

export function saveDismissed(date: string): void {
  localStorage.setItem(DISMISS_KEY, date);
}
