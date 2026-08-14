import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { newStrategy } from "../lib/strategy";

export default function StrategyPicker() {
  const { strategies, selectedIds, setSelectedIds, saveStrategy } = useData();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : strategies.map((s) => s.id).filter((x) => x === id || selectedIds.includes(x));
    // Never leave nothing selected — the whole app filters on this.
    setSelectedIds(next.length > 0 ? next : [id]);
  }

  async function createStrategy(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const s = newStrategy(trimmed);
      await saveStrategy(s);
      setSelectedIds([s.id]);
      setCreating(false);
      setName("");
      navigate(`/strategy/${s.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="strategy-picker">
      <div className="strategy-picker-head">Strategy</div>
      {strategies.map((s) => (
        <div className="strategy-row" key={s.id}>
          <label title={s.name}>
            <input
              type="checkbox"
              checked={selectedIds.includes(s.id)}
              onChange={() => toggle(s.id)}
            />
            <span className="strategy-name">{s.name}</span>
          </label>
          <button
            className="strategy-edit"
            title={`Edit ${s.name}`}
            onClick={() => navigate(`/strategy/${s.id}`)}
          >
            ›
          </button>
        </div>
      ))}

      {creating ? (
        <form onSubmit={createStrategy} style={{ marginTop: 6 }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Strategy name"
            style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setCreating(false);
                setName("");
                setError(null);
              }
            }}
          />
          <div className="row" style={{ gap: 4, marginTop: 5, flexWrap: "nowrap" }}>
            <button type="submit" className="primary strategy-new" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              className="strategy-new"
              onClick={() => {
                setCreating(false);
                setName("");
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
          {error && (
            <div className="error-text" style={{ marginTop: 5 }}>
              {error}
            </div>
          )}
        </form>
      ) : (
        <button className="strategy-new" onClick={() => setCreating(true)}>
          + New strategy
        </button>
      )}
    </div>
  );
}
