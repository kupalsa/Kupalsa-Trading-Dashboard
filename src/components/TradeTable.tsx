import { useState } from "react";
import { useData } from "../lib/DataContext";
import { screenshotUrl } from "../lib/githubStore";
import type { Trade } from "../lib/types";
import TradeForm from "./TradeForm";

function resultPillClass(result: string): string {
  if (result === "W") return "pill win";
  if (result === "L") return "pill loss";
  return "pill be";
}

export default function TradeTable({ strategyIds }: { strategyIds?: string[] }) {
  const { trades, deleteTrade, settings, strategies } = useData();
  const scoped = strategyIds ? trades.filter((t) => strategyIds.includes(t.strategyId)) : trades;
  const sorted = [...scoped].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );

  const [editing, setEditing] = useState<Trade | null>(null);
  const showStrategyCol = strategies.length > 1;
  const strategyName = (id: string) => strategies.find((s) => s.id === id)?.name ?? "—";

  if (sorted.length === 0) {
    return <p className="muted">No trades logged yet.</p>;
  }

  const editingStrategy = editing ? strategies.find((s) => s.id === editing.strategyId) : null;

  return (
    <>
      <table>
        <thead>
          <tr>
            {showStrategyCol && <th>Strategy</th>}
            <th>Date</th>
            <th>Day</th>
            <th>Entry</th>
            <th>Exit</th>
            <th>Direction</th>
            <th>Result</th>
            <th>Stop (pts)</th>
            <th>RR</th>
            <th>Screenshot</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id}>
              {showStrategyCol && <td className="muted">{strategyName(t.strategyId)}</td>}
              <td>{t.date}</td>
              <td>{t.day}</td>
              <td>{t.entryTime || "—"}</td>
              <td>{t.exitTime || "—"}</td>
              <td>
                <span className={t.direction === "Long" ? "pill long" : "pill short"}>{t.direction}</span>
              </td>
              <td>
                <span className={resultPillClass(t.result)}>{t.result}</span>
              </td>
              <td>{t.stopPoints}</td>
              <td style={{ color: t.rr > 0 ? "var(--green)" : t.rr < 0 ? "var(--red)" : undefined }}>
                {t.rr.toFixed(2)}
              </td>
              <td>
                {t.screenshotPath ? (
                  <a href={screenshotUrl(settings, t.screenshotPath)} target="_blank" rel="noreferrer">
                    view
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="muted">{t.note || "—"}</td>
              <td>
                <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  <button onClick={() => setEditing(t)}>Edit</button>
                  <button onClick={() => deleteTrade(t.id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && editingStrategy && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <TradeForm strategy={editingStrategy} initial={editing} onDone={() => setEditing(null)} />
          </div>
        </div>
      )}
    </>
  );
}
