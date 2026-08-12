import { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "../lib/DataContext";
import {
  formatCountdown,
  nextMilestone,
  PHASE_LABEL,
  sessionPhase,
  alertTime,
  type AlertKind,
  type SessionPhase,
} from "../lib/session";
import {
  loadDayState,
  saveDayState,
  TRADE_STATE_LABEL,
  todayStr,
  type DayState,
  type TradeState,
} from "../lib/liveState";
import {
  notifyPermission,
  playSound,
  requestNotifyPermission,
  sendNotification,
  type NotifyPermission,
} from "../lib/notify";

interface Banner {
  title: string;
  body: string;
}

export default function LiveSessionPanel() {
  const { rules } = useData();
  const schedule = rules.schedule;

  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState<DayState>(() => loadDayState());
  const [banner, setBanner] = useState<Banner | null>(null);
  const [perm, setPerm] = useState<NotifyPermission>(() => notifyPermission());

  // Alerts already handled this mount — guards against double-firing when the
  // tick and a re-render race.
  const handled = useRef<Set<AlertKind>>(new Set(day.fired));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const persist = useCallback((next: DayState) => {
    setDay(next);
    saveDayState(next);
  }, []);

  const fire = useCallback(
    (kind: AlertKind, title: string, body: string, sound: "chime" | "alarm") => {
      handled.current.add(kind);
      setBanner({ title, body });
      sendNotification(title, body);
      playSound(sound);
      setDay((prev) => {
        const next = { ...prev, fired: [...new Set([...prev.fired, kind])] };
        saveDayState(next);
        return next;
      });
    },
    [],
  );

  const phase: SessionPhase = sessionPhase(now, schedule);
  const milestone = nextMilestone(now, schedule);

  // Roll over to a fresh day state at midnight.
  useEffect(() => {
    if (day.date !== todayStr(now)) {
      const fresh = loadDayState(now);
      handled.current = new Set(fresh.fired);
      persist(fresh);
    }
  }, [now, day.date, persist]);

  // Alert scheduler. On mount, anything already past is marked handled without
  // notifying, so opening the dashboard late doesn't replay stale alerts.
  const mounted = useRef(false);
  useEffect(() => {
    const kinds: AlertKind[] = ["pre", "entryClose", "marketClose"];

    // Editing the schedule can push an already-fired alert back into the
    // future; it should be allowed to fire again at its new time.
    for (const kind of kinds) {
      const at = alertTime(now, schedule, kind);
      if (handled.current.has(kind) && at && now < at) handled.current.delete(kind);
    }

    for (const kind of kinds) {
      if (handled.current.has(kind)) continue;
      const at = alertTime(now, schedule, kind);
      if (!at || now < at) continue;

      if (!mounted.current) {
        // Missed while the app was closed — record without notifying.
        handled.current.add(kind);
        continue;
      }

      if (kind === "pre") {
        fire(
          "pre",
          "Trading session soon",
          `Session opens at ${schedule.sessionStart}. Get set up.`,
          "chime",
        );
      } else if (kind === "entryClose") {
        fire(
          "entryClose",
          "Entry window closed",
          "Log the session: entry state and adherence checklist.",
          "chime",
        );
      } else if (day.tradeState === "entered") {
        fire(
          "marketClose",
          "Market closed — log your trade",
          "Close the position if it is still open, then log the trade.",
          "alarm",
        );
      } else {
        // No position was taken, so there is nothing to close or log.
        handled.current.add(kind);
      }
    }

    if (!mounted.current) {
      mounted.current = true;
      persist({ ...day, fired: [...handled.current] });
    }
  }, [now, schedule, day, fire, persist]);

  async function enableNotifications() {
    const result = await requestNotifyPermission();
    setPerm(result);
    if (result === "granted") playSound("chime");
  }

  function setTradeState(state: TradeState) {
    persist({ ...day, tradeState: state });
  }

  const isLive = phase === "live";
  const countdown = milestone ? formatCountdown(milestone.at.getTime() - now.getTime()) : null;

  return (
    <div className={`live-panel phase-${phase}`}>
      <div className="live-head">
        <span className="live-status">
          <span className="live-dot" />
          {PHASE_LABEL[phase]}
        </span>
        <span className="live-window">
          {schedule.sessionStart}–{schedule.entryWindowClose}
          <span className="muted"> · flat {schedule.marketClose}</span>
        </span>
      </div>

      {milestone && countdown && (
        <div className="live-countdown">
          {milestone.label} in <strong>{countdown}</strong>
        </div>
      )}
      {!milestone && (
        <div className="live-countdown muted">
          {phase === "off" ? "Not a trading day" : "Session finished for today"}
        </div>
      )}

      {(isLive || phase === "holding") && (
        <div className="live-states">
          {(["pending", "entered", "none"] as TradeState[]).map((s) => (
            <button
              key={s}
              className={day.tradeState === s ? "active" : ""}
              onClick={() => setTradeState(s)}
            >
              {TRADE_STATE_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      {perm === "default" && (
        <button className="live-enable" onClick={enableNotifications}>
          Enable desktop alerts
        </button>
      )}
      {perm === "denied" && (
        <div className="small-note">
          Desktop alerts are blocked in your browser. In-app alerts still appear here.
        </div>
      )}

      {banner && (
        <div className="live-banner">
          <div>
            <strong>{banner.title}</strong>
            <div className="small-note">{banner.body}</div>
          </div>
          <button onClick={() => setBanner(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
