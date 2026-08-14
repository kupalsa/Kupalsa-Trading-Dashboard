import { useNavigate } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { newStrategy } from "../lib/strategy";

export default function StrategyPicker() {
  const { strategies, selectedIds, setSelectedIds, saveStrategy } = useData();
  const navigate = useNavigate();

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...strategies.map((s) => s.id).filter((x) => x === id || selectedIds.includes(x))];
    // never leave nothing selected
    setSelectedIds(next.length > 0 ? next : [id]);
  }

  async function createStrategy() {
    const name = window.prompt("Name for the new strategy");
    if (!name?.trim()) return;
    const s = newStrategy(name.trim());
    await saveStrategy(s);
    setSelectedIds([s.id]);
    navigate(`/strategy/${s.id}`);
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
      <button className="strategy-new" onClick={createStrategy}>
        + New strategy
      </button>
    </div>
  );
}
