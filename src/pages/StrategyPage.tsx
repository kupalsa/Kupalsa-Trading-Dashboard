import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "../lib/DataContext";
import PlaybookEditor from "../components/PlaybookEditor";
import type { SessionSchedule } from "../lib/session";
import type { PlaybookStep, Strategy } from "../lib/strategy";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Tab = "rules" | "playbook";

export default function StrategyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { strategies, selectedIds, saveStrategy, deleteStrategy, githubReady, loading } = useData();

  const strategy = strategies.find((s) => s.id === id) ?? strategies.find((s) => s.id === selectedIds[0]);

  const [draft, setDraft] = useState<Strategy | null>(strategy ?? null);
  const [tab, setTab] = useState<Tab>("rules");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(strategy ?? null);
    setSaved(false);
  }, [strategy]);

  if (!githubReady) {
    return <div className="panel">Connect GitHub in Settings to edit strategies.</div>;
  }
  if (loading && !draft) return <p className="muted">Loading…</p>;
  if (!draft) return <div className="panel">Strategy not found.</div>;

  function set<K extends keyof Strategy>(key: K, value: Strategy[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setSaved(false);
  }

  function setSchedule<K extends keyof SessionSchedule>(key: K, value: SessionSchedule[K]) {
    setDraft((d) => (d ? { ...d, schedule: { ...d.schedule, [key]: value } } : d));
    setSaved(false);
  }

  function toggleDay(day: number) {
    setDraft((d) => {
      if (!d) return d;
      const days = d.schedule.tradingDays.includes(day)
        ? d.schedule.tradingDays.filter((x) => x !== day)
        : [...d.schedule.tradingDays, day].sort();
      return { ...d, schedule: { ...d.schedule, tradingDays: days } };
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await saveStrategy(draft);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft) return;
    if (!window.confirm(`Delete strategy "${draft.name}"? Its logged trades are kept.`)) return;
    await deleteStrategy(draft.id);
    navigate("/");
  }

  const orderIssue =
    draft.schedule.sessionStart >= draft.schedule.entryWindowClose ||
    draft.schedule.entryWindowClose > draft.schedule.marketClose;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{draft.name}</h1>
        <div className="row">
          <div className="toggle-group">
            <button className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}>
              Rules &amp; schedule
            </button>
            <button className={tab === "playbook" ? "active" : ""} onClick={() => setTab("playbook")}>
              Playbook ({draft.playbook.length})
            </button>
          </div>
        </div>
      </div>

      {tab === "rules" ? (
        <>
          <div className="panel">
            <h2>Identity</h2>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Strategy name</label>
              <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </div>
          </div>

          <div className="panel">
            <h2>Session schedule</h2>
            <p className="small-note" style={{ marginTop: 0 }}>
              Drives this strategy's live panel and its session alerts.
            </p>

            <div className="field" style={{ marginBottom: 12 }}>
              <label>Trading days</label>
              <div className="chip-group">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={label}
                    className={draft.schedule.tradingDays.includes(i) ? "chip active-chip" : "chip"}
                    onClick={() => toggleDay(i)}
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
                  value={draft.schedule.sessionStart}
                  onChange={(e) => setSchedule("sessionStart", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Entry window closes</label>
                <input
                  type="time"
                  value={draft.schedule.entryWindowClose}
                  onChange={(e) => setSchedule("entryWindowClose", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Market close (flat)</label>
                <input
                  type="time"
                  value={draft.schedule.marketClose}
                  onChange={(e) => setSchedule("marketClose", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Heads-up (minutes)</label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={draft.schedule.preAlertMinutes}
                  onChange={(e) => setSchedule("preAlertMinutes", Number(e.target.value))}
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
              value={draft.strategyRules}
              onChange={(e) => set("strategyRules", e.target.value)}
              placeholder="Trigger, validation, stop/TP rules, priorities…"
            />
          </div>

          <div className="panel">
            <h2>Strategy Notes</h2>
            <textarea
              style={{ minHeight: 160 }}
              value={draft.strategyNotes}
              onChange={(e) => set("strategyNotes", e.target.value)}
              placeholder="Freeform notes about the strategy…"
            />
          </div>
        </>
      ) : (
        <div className="panel">
          <h2>Playbook</h2>
          <PlaybookEditor
            strategyId={draft.id}
            steps={draft.playbook}
            onChange={(steps: PlaybookStep[]) => set("playbook", steps)}
          />
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <button className="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save strategy"}
          </button>
          {saved && <span className="success-text">Saved</span>}
        </div>
        {strategies.length > 1 && (
          <button onClick={handleDelete} style={{ color: "var(--red)" }}>
            Delete strategy
          </button>
        )}
      </div>
    </div>
  );
}
