import { useEffect, useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { sessionConcluded } from "../lib/session";
import {
  emptyChecklist,
  ENTRY_STATES,
  isAdherent,
  SESSION_OUTCOMES,
  type DailyReviewChecklist,
  type EntryState,
  type SessionOutcome,
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

export default function DailyReviewPanel() {
  const { dailyReviews, trades, rules, saveDailyReview } = useData();
  const [date, setDate] = useState(todayStr());
  const [sessionOutcome, setSessionOutcome] = useState<SessionOutcome | "">("");
  const [entryState, setEntryState] = useState<EntryState | "">("");
  const [checklist, setChecklist] = useState<DailyReviewChecklist>(emptyChecklist);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = dailyReviews.find((r) => r.date === date);
    setSessionOutcome(existing?.sessionOutcome ?? "");
    setEntryState(existing?.entryState ?? "");
    setChecklist(existing?.checklist ?? emptyChecklist);
    setNotes(existing?.notes ?? "");
    setSaved(false);
  }, [date, dailyReviews]);

  const dayTrades = useMemo(() => trades.filter((t) => t.date === date), [trades, date]);
  const totalR = useMemo(() => dayTrades.reduce((sum, t) => sum + t.rr, 0), [dayTrades]);

  const adherent = isAdherent({ date, sessionOutcome, entryState, checklist, notes });

  // Flag an unlogged session, but only once its entry window has shut —
  // glowing all morning about a session that hasn't happened is just noise.
  const alreadySaved = dailyReviews.some((r) => r.date === date);
  const needsLog = !alreadySaved && sessionConcluded(date, new Date(), rules.schedule);

  function toggle(key: keyof DailyReviewChecklist) {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDailyReview({ date, sessionOutcome, entryState, checklist, notes });
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
        <div className="field">
          <label>Entry State</label>
          <select value={entryState} onChange={(e) => setEntryState(e.target.value as EntryState)}>
            <option value="">—</option>
            {ENTRY_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        {(Object.keys(CHECKLIST_LABELS) as (keyof DailyReviewChecklist)[]).map((key) => (
          <div className="checkbox-row" style={{ marginBottom: 6 }} key={key}>
            <input
              type="checkbox"
              id={key}
              checked={checklist[key]}
              onChange={() => toggle(key)}
            />
            <label htmlFor={key}>{CHECKLIST_LABELS[key]}</label>
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
    </div>
  );
}
