import { useEffect, useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { sessionConcluded } from "../lib/session";
import type { Strategy } from "../lib/strategy";
import {
  emptyChecklist,
  isAdherent,
  SESSION_OUTCOMES,
  SESSION_STATES,
  type DailyReviewChecklist,
  type SessionOutcome,
  type SessionState,
} from "../lib/types";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CHECKLIST_LABELS: Record<keyof DailyReviewChecklist, string> = {
  backtestValid: "Backtest Valid",
  executionOnlyFocus: "Focus on Perfect Execution",
  noInterference: "No Interference",
  sessionLogged: "Session Logged",
  stopEntryTpFollowed: "Stop → Entry → TP Followed",
  strategyValid: "Strategy Valid",
  structureValid: "Structure Valid",
};

export default function DailyReviewPanel({ strategy }: { strategy: Strategy }) {
  const { dailyReviews, trades, saveDailyReview } = useData();
  const [date, setDate] = useState(todayStr());
  const [sessionOutcome, setSessionOutcome] = useState<SessionOutcome | "">("");
  const [states, setStates] = useState<SessionState[]>([]);
  const [checklist, setChecklist] = useState<DailyReviewChecklist>(emptyChecklist);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const history = useMemo(
    () =>
      dailyReviews
        .filter((r) => r.strategyId === strategy.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [dailyReviews, strategy.id],
  );

  useEffect(() => {
    const existing = dailyReviews.find((r) => r.date === date && r.strategyId === strategy.id);
    setSessionOutcome(existing?.sessionOutcome ?? "");
    setStates(existing?.states ?? []);
    setChecklist(existing?.checklist ?? emptyChecklist);
    setNotes(existing?.notes ?? "");
    setSaved(false);
  }, [date, dailyReviews, strategy.id]);

  const dayTrades = useMemo(
    () => trades.filter((t) => t.date === date && t.strategyId === strategy.id),
    [trades, date, strategy.id],
  );
  const totalR = useMemo(() => dayTrades.reduce((sum, t) => sum + t.rr, 0), [dayTrades]);

  const adherent = isAdherent({ strategyId: strategy.id, date, sessionOutcome, states, checklist, notes });

  // Flag an unlogged session, but only once its entry window has shut —
  // glowing all morning about a session that hasn't happened is just noise.
  const alreadySaved = dailyReviews.some((r) => r.date === date && r.strategyId === strategy.id);
  const needsLog = !alreadySaved && sessionConcluded(date, new Date(), strategy.schedule);

  function toggle(key: keyof DailyReviewChecklist) {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
  }

  function toggleState(s: SessionState) {
    setStates((prev) =>
      prev.includes(s)
        ? prev.filter((x) => x !== s)
        : // keep the canonical order rather than click order
          SESSION_STATES.filter((x) => x === s || prev.includes(x)),
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDailyReview({ strategyId: strategy.id, date, sessionOutcome, states, checklist, notes });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={needsLog ? "panel needs-log" : "panel"}>
      <h2>
        End of Day Review
        {needsLog && <span className="needs-log-badge">Not logged</span>}
      </h2>

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="field" style={{ maxWidth: 180 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Num of trades</label>
          <input value={dayTrades.length} disabled style={{ width: 80 }} />
        </div>
        <div className="field">
          <label>Total R</label>
          <input
            value={totalR.toFixed(2)}
            disabled
            style={{ width: 80, color: totalR > 0 ? "var(--green)" : totalR < 0 ? "var(--red)" : undefined }}
          />
        </div>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="field">
          <label>Session Outcome</label>
          <select value={sessionOutcome} onChange={(e) => setSessionOutcome(e.target.value as SessionOutcome)}>
            <option value="">—</option>
            {SESSION_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>State during session</label>
        <div className="chip-group">
          {SESSION_STATES.map((s) => (
            <button
              key={s}
              type="button"
              className={states.includes(s) ? "chip active-chip" : "chip"}
              aria-pressed={states.includes(s)}
              onClick={() => toggleState(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        {(Object.keys(CHECKLIST_LABELS) as (keyof DailyReviewChecklist)[]).map((key) => (
          <div className="checkbox-row" style={{ marginBottom: 6 }} key={key}>
            <input
              type="checkbox"
              id={`${strategy.id}-${key}`}
              checked={checklist[key]}
              onChange={() => toggle(key)}
            />
            <label htmlFor={`${strategy.id}-${key}`}>{CHECKLIST_LABELS[key]}</label>
          </div>
        ))}
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Note</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
      </div>

      <div className="row">
        <span className={adherent ? "pill win" : "pill loss"}>{adherent ? "Adherent" : "Not adherent"}</span>
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save review"}
        </button>
        {saved && <span className="success-text">Saved</span>}
      </div>

      <button
        type="button"
        className="history-toggle"
        onClick={() => setHistoryOpen((o) => !o)}
      >
        {historyOpen ? "▾" : "▸"} Past reviews ({history.length})
      </button>

      {historyOpen && (
        <div className="history-list">
          {history.length === 0 && <p className="muted" style={{ margin: 0 }}>None logged yet.</p>}
          {history.map((r) => (
            <button
              type="button"
              key={r.date}
              className={r.date === date ? "history-row active" : "history-row"}
              onClick={() => setDate(r.date)}
            >
              <span className="history-date">{r.date}</span>
              <span className={isAdherent(r) ? "pill win" : "pill loss"}>
                {isAdherent(r) ? "Adherent" : "Not adherent"}
              </span>
              <span className="small-note">{r.sessionOutcome || "—"}</span>
              <span className="small-note">{r.states.join(", ") || "—"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
