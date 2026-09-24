import { useEffect, useRef, useState } from "react";
import { useData } from "../lib/DataContext";
import {
  defaultGldStg1Setup,
  newBacktestSetup,
  type BacktestSetup,
  type LoggerQuestion,
} from "../lib/backtestSetup";
import BacktestWizard from "./BacktestWizard";
import BacktestSetupEditor from "./BacktestSetupEditor";

const ACTIVE_SETUP_KEY = "trading-dashboard-active-backtest-setup";

/**
 * Strategies with a hand-built logger that pre-dated this feature get their
 * question set seeded automatically by exact name match, instead of making
 * the user rebuild dozens of questions from scratch through the editor.
 */
const SEED_BY_STRATEGY_NAME: Record<string, (strategyId: string) => BacktestSetup> = {
  GLD_STG_1: defaultGldStg1Setup,
};

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
export default function BacktestHelperPanel({
  strategyId,
  strategyName,
}: {
  strategyId: string;
  strategyName: string;
}) {
  const { backtestSetups, saveBacktestSetup, deleteBacktestSetup } = useData();
  const setupsHere = backtestSetups.filter((s) => s.strategyId === strategyId);

  const [activeId, setActiveId] = useState<string | null>(() => loadActiveMap()[strategyId] ?? null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Switching strategies (via the Backtest page's dropdown) doesn't remount
  // this component, so both the remembered active setup and the seeding
  // guard below must react to strategyId changing, not just run once.
  const seededIds = useRef(new Set<string>());
  useEffect(() => {
    setActiveId(loadActiveMap()[strategyId] ?? null);
    setEditing(false);
  }, [strategyId]);

  useEffect(() => {
    const seedFn = SEED_BY_STRATEGY_NAME[strategyName.trim()];
    if (seededIds.current.has(strategyId) || setupsHere.length > 0 || !seedFn) return;
    seededIds.current.add(strategyId);
    const setup = seedFn(strategyId);
    saveBacktestSetup(setup).then(() => setActiveId(setup.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupsHere.length, strategyId, strategyName]);

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
