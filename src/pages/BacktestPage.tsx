import { useState } from "react";
import { useData } from "../lib/DataContext";
import BacktestHelperPanel from "../components/BacktestHelperPanel";
import BacktestEntryList from "../components/BacktestEntryList";

export default function BacktestPage() {
  const { githubReady, loading, strategies, selectedIds } = useData();

  // A backtest is always scoped to exactly one strategy.
  const [focusId, setFocusId] = useState<string | null>(null);
  const strategy =
    strategies.find((s) => s.id === focusId) ??
    strategies.find((s) => s.id === selectedIds[0]) ??
    strategies[0];

  if (!githubReady) {
    return <div className="panel">Connect GitHub in Settings to use the backtest log.</div>;
  }
  if (!strategy) return <div className="panel">Create a strategy first.</div>;

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Backtest</h1>
        {strategies.length > 1 ? (
          <select
            value={strategy.id}
            onChange={(e) => setFocusId(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="small-note">{strategy.name}</span>
        )}
      </div>

      {loading && <p className="muted">Loading…</p>}

      <BacktestHelperPanel strategyId={strategy.id} strategyName={strategy.name} />
      <BacktestEntryList strategyId={strategy.id} />
    </div>
  );
}
