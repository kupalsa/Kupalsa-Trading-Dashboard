import { useEffect, useState } from "react";
import { useData } from "../lib/DataContext";
import { defaultSchedule, type SessionSchedule } from "../lib/session";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RulesPage() {
  const { rules, saveRules, githubReady, loading } = useData();
  const [strategyRules, setStrategyRules] = useState(rules.strategyRules);
  const [strategyNotes, setStrategyNotes] = useState(rules.strategyNotes);
  const [schedule, setSchedule] = useState<SessionSchedule>(rules.schedule ?? defaultSchedule);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStrategyRules(rules.strategyRules);
    setStrategyNotes(rules.strategyNotes);
    setSchedule(rules.schedule ?? defaultSchedule);
  }, [rules]);

  function setField<K extends keyof SessionSchedule>(key: K, value: SessionSchedule[K]) {
    setSchedule((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }

  function toggleDay(day: number) {
    setSchedule((s) => ({
      ...s,
      tradingDays: s.tradingDays.includes(day)
        ? s.tradingDays.filter((d) => d !== day)
        : [...s.tradingDays, day].sort(),
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveRules({ strategyRules, strategyNotes, schedule });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!githubReady) {
    return <div className="panel">Connect GitHub in Settings to edit rules &amp; notes.</div>;
  }

  const orderIssue =
    schedule.sessionStart >= schedule.entryWindowClose ||
    schedule.entryWindowClose > schedule.marketClose;

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Rules &amp; Notes</h1>
      {loading && <p className="muted">Loading…</p>}

      <div className="panel">
        <h2>Session schedule</h2>
        <p className="small-note" style={{ marginTop: 0 }}>
          Drives the live session panel on the Log page and every session alert.
        </p>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Trading days</label>
          <div className="row" style={{ gap: 6 }}>
            {DAY_LABELS.map((label, i) => (
              <button
                key={label}
                className={schedule.tradingDays.includes(i) ? "active-chip" : ""}
                onClick={() => toggleDay(i)}
                style={{ padding: "5px 11px" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Session opens</label>
            <input
              type="time"
              value={schedule.sessionStart}
              onChange={(e) => setField("sessionStart", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Entry window closes</label>
            <input
              type="time"
              value={schedule.entryWindowClose}
              onChange={(e) => setField("entryWindowClose", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Market close (flat)</label>
            <input
              type="time"
              value={schedule.marketClose}
              onChange={(e) => setField("marketClose", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Heads-up (minutes)</label>
            <input
              type="number"
              min={0}
              max={240}
              value={schedule.preAlertMinutes}
              onChange={(e) => setField("preAlertMinutes", Number(e.target.value))}
              style={{ width: 90 }}
            />
          </div>
        </div>

        {orderIssue && (
          <div className="notice warn" style={{ marginTop: 12, marginBottom: 0 }}>
            Times should run in order: open, then entry close, then market close.
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Strategy Rules</h2>
        <textarea
          style={{ minHeight: 200 }}
          value={strategyRules}
          onChange={(e) => {
            setStrategyRules(e.target.value);
            setSaved(false);
          }}
          placeholder="Trigger, validation, stop/TP rules, priorities…"
        />
      </div>

      <div className="panel">
        <h2>Strategy Notes</h2>
        <textarea
          style={{ minHeight: 200 }}
          value={strategyNotes}
          onChange={(e) => {
            setStrategyNotes(e.target.value);
            setSaved(false);
          }}
          placeholder="Freeform notes about the strategy…"
        />
      </div>

      <div className="row">
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="success-text">Saved</span>}
      </div>
    </div>
  );
}
