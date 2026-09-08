import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  normalizeTimeSession,
  pause as pauseSession,
  resume as resumeSession,
  type TimeSession,
} from "./timeTracking";

/**
 * The timer that is currently running lives in localStorage, not in the data
 * repo: it changes every second, and every repo write is a commit. Only a
 * finished session is persisted. This mirrors how the live session panel keeps
 * its day state.
 */
const KEY = "trading-dashboard-active-timer";

/** How often the running timer records that the app was still open. */
const HEARTBEAT_MS = 10_000;

export function loadActiveTimer(): TimeSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalizeTimeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveActiveTimer(session: TimeSession | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode): the timer still works in memory.
  }
}

interface ActiveTimerValue {
  active: TimeSession | null;
  /** Ticks once a second so consumers re-render; elapsed is always derived. */
  now: Date;
  start: (category: string) => void;
  pause: () => void;
  resume: () => void;
  /** Removes it from local state and hands it back for saving. */
  take: () => TimeSession | null;
  set: (session: TimeSession | null) => void;
}

const Ctx = createContext<ActiveTimerValue | null>(null);

export function ActiveTimerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<TimeSession | null>(() => loadActiveTimer());
  const [now, setNow] = useState(() => new Date());
  const activeRef = useRef(active);
  activeRef.current = active;

  const set = useCallback((session: TimeSession | null) => {
    setActive(session);
    saveActiveTimer(session);
  }, []);

  // One clock for the whole app; elapsed is computed from timestamps, so a
  // throttled or missed tick costs nothing but a late repaint.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Record that the app is still open, so a timer left running overnight can
  // be trimmed back to the last moment we know it was being used.
  useEffect(() => {
    const id = setInterval(() => {
      const current = activeRef.current;
      if (!current) return;
      const last = current.segments[current.segments.length - 1];
      if (!last || last.end !== null) return;
      const stamped = { ...current, lastSeen: new Date().toISOString() };
      activeRef.current = stamped;
      saveActiveTimer(stamped);
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);

  const start = useCallback(
    (category: string) => {
      const iso = new Date().toISOString();
      set({
        id: crypto.randomUUID(),
        category,
        segments: [{ start: iso, end: null }],
        note: "",
        createdAt: iso,
        lastSeen: iso,
      });
    },
    [set],
  );

  const pause = useCallback(() => {
    if (activeRef.current) set(pauseSession(activeRef.current));
  }, [set]);

  const resume = useCallback(() => {
    if (activeRef.current) set(resumeSession(activeRef.current));
  }, [set]);

  const take = useCallback(() => {
    const current = activeRef.current;
    set(null);
    return current;
  }, [set]);

  return (
    <Ctx.Provider value={{ active, now, start, pause, resume, take, set }}>{children}</Ctx.Provider>
  );
}

export function useActiveTimer(): ActiveTimerValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveTimer must be used within ActiveTimerProvider");
  return ctx;
}
