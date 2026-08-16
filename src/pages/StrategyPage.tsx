import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "../lib/DataContext";
import PlaybookEditor from "../components/PlaybookEditor";
import ConfirmDialog from "../components/ConfirmDialog";
import type { SessionSchedule } from "../lib/session";
import { STOP_FORMATS, type PlaybookStep, type Strategy, type StrategyDefinition } from "../lib/strategy";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function setDef<K extends keyof StrategyDefinition>(key: K, value: StrategyDefinition[K]) {
    setDraft((d) => (d ? { ...d, definition: { ...d.definition, [key]: value } } : d));
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
    setError(null);
    try {
      await saveStrategy(draft);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft) return;
    setError(null);
    setDeleteBusy(true);
    try {
      await deleteStrategy(draft.id);
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConfirmDelete(false);
    } finally {
      setDeleteBusy(false);
    }
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
            <div className="row">
              <div className="field" style={{ flex: 1, minWidth: 220 }}>
                <label>Strategy name</label>
                <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Assets</label>
                <input
                  value={draft.definition.assets}
                  onChange={(e) => setDef("assets", e.target.value)}
                  placeholder="MGC"
                />
              </div>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Strategy pattern</label>
              <textarea
                value={draft.definition.strategyPattern}
                onChange={(e) => setDef("strategyPattern", e.target.value)}
                placeholder="The setup this strategy is built around…"
                style={{ minHeight: 60 }}
              />
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
            <h2>Trigger</h2>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Trigger</label>
              <textarea
                value={draft.definition.trigger}
                onChange={(e) => setDef("trigger", e.target.value)}
                placeholder="What puts this setup on the radar…"
                style={{ minHeight: 56 }}
              />
            </div>
            <div className="field" style={{ maxWidth: 220 }}>
              <label>Trigger time-frame</label>
              <input
                value={draft.definition.triggerTimeFrame}
                onChange={(e) => setDef("triggerTimeFrame", e.target.value)}
                placeholder="15M-4H"
              />
            </div>
          </div>

          <div className="panel">
            <h2>Validation</h2>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Validation (entry)</label>
              <textarea
                value={draft.definition.validationEntry}
                onChange={(e) => setDef("validationEntry", e.target.value)}
                placeholder="What confirms the entry…"
                style={{ minHeight: 56 }}
              />
            </div>
            <div className="field" style={{ maxWidth: 220 }}>
              <label>Validation time-frame</label>
              <input
                value={draft.definition.validationTimeFrame}
                onChange={(e) => setDef("validationTimeFrame", e.target.value)}
                placeholder="1M"
              />
            </div>
          </div>

          <div className="panel">
            <h2>Stop</h2>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Stop</label>
              <textarea
                value={draft.definition.stop}
                onChange={(e) => setDef("stop", e.target.value)}
                placeholder="Where the stop goes and why…"
                style={{ minHeight: 56 }}
              />
            </div>
            <div className="row">
              <div className="field">
                <label>Stop format</label>
                <select
                  value={draft.definition.stopFormat}
                  onChange={(e) => setDef("stopFormat", e.target.value)}
                >
                  {STOP_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Stop time-frame</label>
                <input
                  value={draft.definition.stopTimeFrame}
                  onChange={(e) => setDef("stopTimeFrame", e.target.value)}
                  placeholder="15M/1H"
                />
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Take profit</h2>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>TP</label>
              <textarea
                value={draft.definition.takeProfit}
                onChange={(e) => setDef("takeProfit", e.target.value)}
                placeholder="Where the target sits…"
                style={{ minHeight: 56 }}
              />
            </div>
            <div className="row">
              <div className="field">
                <label>TP time-frame</label>
                <input
                  value={draft.definition.tpTimeFrame}
                  onChange={(e) => setDef("tpTimeFrame", e.target.value)}
                  placeholder="15M/1H"
                />
              </div>
              <div className="field">
                <label>Partial TP</label>
                <input
                  value={draft.definition.partialTp}
                  onChange={(e) => setDef("partialTp", e.target.value)}
                  placeholder="None"
                />
              </div>
              <div className="field">
                <label>Minimal R target</label>
                <input
                  value={draft.definition.minimalRTarget}
                  onChange={(e) => setDef("minimalRTarget", e.target.value)}
                  placeholder="2R"
                />
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Bigger picture</h2>
            <textarea
              value={draft.definition.biggerPicture}
              onChange={(e) => setDef("biggerPicture", e.target.value)}
              placeholder="Top-down analysis, higher time-frame context…"
              style={{ minHeight: 80 }}
            />
          </div>

          <div className="panel">
            <h2>Additional Rules</h2>
            <textarea
              style={{ minHeight: 160 }}
              value={draft.strategyRules}
              onChange={(e) => set("strategyRules", e.target.value)}
              placeholder="Anything not covered by the fields above…"
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
          {error && <span className="error-text">{error}</span>}
        </div>

        {strategies.length > 1 && (
          <button className="danger" onClick={() => setConfirmDelete(true)}>
            Delete strategy
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this strategy?"
          message={`"${draft.name}" will be removed. Its logged trades, reviews and backtest opportunities are kept, just no longer grouped under this strategy.`}
          busy={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
