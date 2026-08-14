import { useEffect, useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import type { Trade } from "../lib/types";
import TradeForm from "./TradeForm";
import { RepoImageLink } from "./RepoImage";

const PAGE_SIZES = [10, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

function resultPillClass(result: string): string {
  if (result === "W") return "pill win";
  if (result === "L") return "pill loss";
  return "pill be";
}

export default function TradeTable({ strategyIds }: { strategyIds?: string[] }) {
  const { trades, deleteTrade, strategies } = useData();

  const sorted = useMemo(() => {
    const scoped = strategyIds ? trades.filter((t) => strategyIds.includes(t.strategyId)) : trades;
    return [...scoped].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  }, [trades, strategyIds]);

  const [editing, setEditing] = useState<Trade | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));

  // Deleting rows or changing page size can strand you past the last page.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const start = page * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const showStrategyCol = strategies.length > 1;
  const strategyName = (id: string) => strategies.find((s) => s.id === id)?.name ?? "—";

  if (sorted.length === 0) {
    return <p className="muted">No trades logged yet.</p>;
  }

  const editingStrategy = editing ? strategies.find((s) => s.id === editing.strategyId) : null;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div className="toggle-group">
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              className={pageSize === n ? "active" : ""}
              onClick={() => {
                setPageSize(n);
                setPage(0);
              }}
            >
              Last {n}
            </button>
          ))}
        </div>

        {pageCount > 1 && (
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              ←
            </button>
            <span className="small-note">
              {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              →
            </button>
          </div>
        )}
      </div>

      <div className="scroll-x">
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
            {visible.map((t) => (
              <tr key={t.id}>
                {showStrategyCol && <td className="muted">{strategyName(t.strategyId)}</td>}
                <td>{t.date}</td>
                <td>{t.day}</td>
                <td>{t.entryTime || "—"}</td>
                <td>{t.exitTime || "—"}</td>
                <td>
                  <span className={t.direction === "Long" ? "pill long" : "pill short"}>
                    {t.direction}
                  </span>
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
                    <RepoImageLink path={t.screenshotPath}>view</RepoImageLink>
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
      </div>

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
