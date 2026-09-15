import { useEffect, useState } from "react";
import { useData } from "../lib/DataContext";
import { defaultGldStg1Setup, newBacktestSetup, type LoggerQuestion } from "../lib/backtestSetup";
import { DEFAULT_STRATEGY_ID } from "../lib/strategy";
import BacktestWizard from "./BacktestWizard";
import BacktestSetupEditor from "./BacktestSetupEditor";

const ACTIVE_SETUP_KEY = "trading-dashboard-active-backtest-setup";

function loadActiveMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ACTIVE_SETUP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * The native trade-logging wizard: question sequences ("setups") live in repo
 * data instead of an uploaded HTML file, so multiple setups can exist per
 * strategy and be switched between or edited in place.
 */
export default function BacktestHelperPanel({ strategyId }: { strategyId: string }) {
  const { backtestSetups, saveBacktestSetup, deleteBacktestSetup } = useData();
  const setupsHere = backtestSetups.filter((s) => s.strategyId === strategyId);

  const [activeId, setActiveId] = useState<string | null>(() => loadActiveMap()[strategyId] ?? null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  // GLD_STG_1 already had a hand-built 26-question tool before this feature
  // existed — seed its native equivalent once so nothing is lost, instead of
  // making the user rebuild it from scratch.
  useEffect(() => {
    if (seeded || setupsHere.length > 0 || strategyId !== DEFAULT_STRATEGY_ID) return;
    setSeeded(true);
    const setup = defaultGldStg1Setup(strategyId);
    saveBacktestSetup(setup).then(() => setActiveId(setup.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, setupsHere.length, strategyId]);

  const active = setupsHere.find((s) => s.id === activeId) ?? setupsHere[0] ?? null;

  useEffect(() => {
    if (!active) return;
    const map = loadActiveMap();
    map[strategyId] = active.id;
    localStorage.setItem(ACTIVE_SETUP_KEY, JSON.stringify(map));
  }, [active, strategyId]);

  async function createSetup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const setup = newBacktestSetup(trimmed, strategyId);
      await saveBacktestSetup(setup);
      setActiveId(setup.id);
      setCreating(false);
      setNewName("");
      setEditing(true); // a brand-new setup starts with no questions — go straight to adding them
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestions(questions: LoggerQuestion[]) {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await saveBacktestSetup({ ...active, questions });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeActiveSetup() {
    if (!active) return;
    if (!confirm(`Delete "${active.name}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteBacktestSetup(active.id);
      setActiveId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>{active ? active.name : "Trade Logger"}</h2>

      <div className="row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        {setupsHere.length > 1 && (
          <select
            value={active?.id ?? ""}
            onChange={(e) => {
              setActiveId(e.target.value);
              setEditing(false);
            }}
            style={{ maxWidth: 220 }}
          >
            {setupsHere.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {active && !editing && (
          <button type="button" onClick={() => setEditing(true)}>
            Edit questions
          </button>
        )}
        {active && !editing && setupsHere.length > 0 && (
          <button type="button" className="danger" onClick={removeActiveSetup} disabled={busy}>
            Delete setup
          </button>
        )}
        {!creating && (
          <button type="button" onClick={() => setCreating(true)}>
            + New setup
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={createSetup} className="row" style={{ marginBottom: 12 }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Setup name"
            style={{ maxWidth: 220 }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
          />
          <button type="submit" className="primary" disabled={busy || !newName.trim()}>
            {busy ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            disabled={busy}
          >
            Cancel
          </button>
        </form>
      )}

      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

      {!active && !creating && (
        <p className="muted">No trade-logger setup yet for this strategy — create one above.</p>
      )}

      {active && editing && (
        <BacktestSetupEditor
          setup={active}
          saving={busy}
          onSave={saveQuestions}
          onCancel={() => setEditing(false)}
        />
      )}

      {active && !editing && <BacktestWizard setup={active} />}

      <p className="wizard-hint">
        📸 Attach the trade's closing screenshot in the chat along with this summary when you paste
        it — Claude reads the price levels, direction and setup colour from that image.
      </p>
    </div>
  );
}
