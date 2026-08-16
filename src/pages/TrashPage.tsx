import { useState } from "react";
import { useData } from "../lib/DataContext";
import { daysLeft, TRASH_RETENTION_DAYS } from "../lib/trash";
import ConfirmDialog from "../components/ConfirmDialog";

export default function TrashPage() {
  const {
    trash,
    strategies,
    githubReady,
    restoreTrade,
    purgeTrashedTrade,
    restoreOpportunity,
    purgeTrashedOpportunity,
    emptyTrashNow,
  } = useData();

  const [purgeTarget, setPurgeTarget] = useState<{ kind: "trade" | "opportunity"; id: string } | null>(
    null,
  );
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const strategyName = (id: string) => strategies.find((s) => s.id === id)?.name ?? "—";
  const total = trash.trades.length + trash.opportunities.length;

  if (!githubReady) {
    return <div className="panel">Connect GitHub in Settings to see recently deleted items.</div>;
  }

  async function confirmPurge() {
    if (!purgeTarget) return;
    setBusy(true);
    try {
      if (purgeTarget.kind === "trade") await purgeTrashedTrade(purgeTarget.id);
      else await purgeTrashedOpportunity(purgeTarget.id);
      setPurgeTarget(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEmpty() {
    setBusy(true);
    try {
      await emptyTrashNow();
      setEmptyConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Recently Deleted</h1>
        {total > 0 && (
          <button className="danger" onClick={() => setEmptyConfirm(true)}>
            Empty trash
          </button>
        )}
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Deleted items stay here for {TRASH_RETENTION_DAYS} days, then are cleared automatically. Restore
        anything you didn&rsquo;t mean to delete, or clear it yourself.
      </p>

      {total === 0 && <p className="muted">Trash is empty.</p>}

      {trash.trades.length > 0 && (
        <div className="panel trash-section">
          <h2>Trades ({trash.trades.length})</h2>
          {trash.trades.map((t) => (
            <div className="trash-row" key={t.id}>
              <span>
                {t.date} &middot; {strategyName(t.strategyId)} &middot; {t.direction} {t.result}
              </span>
              <span className="small-note">{daysLeft(t.deletedAt)}d left</span>
              <button onClick={() => restoreTrade(t.id)}>Restore</button>
              <button className="danger" onClick={() => setPurgeTarget({ kind: "trade", id: t.id })}>
                Delete forever
              </button>
            </div>
          ))}
        </div>
      )}

      {trash.opportunities.length > 0 && (
        <div className="panel trash-section">
          <h2>Backtest opportunities ({trash.opportunities.length})</h2>
          {trash.opportunities.map((o) => (
            <div className="trash-row" key={o.id}>
              <span>
                #{o.seq} &middot; {o.date || "—"} &middot; {strategyName(o.strategyId)}
              </span>
              <span className="small-note">{daysLeft(o.deletedAt)}d left</span>
              <button onClick={() => restoreOpportunity(o.id)}>Restore</button>
              <button
                className="danger"
                onClick={() => setPurgeTarget({ kind: "opportunity", id: o.id })}
              >
                Delete forever
              </button>
            </div>
          ))}
        </div>
      )}

      {purgeTarget && (
        <ConfirmDialog
          title="Delete forever?"
          message="This item will be permanently removed and can't be restored."
          confirmLabel="Delete forever"
          busy={busy}
          onConfirm={confirmPurge}
          onCancel={() => setPurgeTarget(null)}
        />
      )}

      {emptyConfirm && (
        <ConfirmDialog
          title="Empty trash?"
          message={`All ${total} item${total === 1 ? "" : "s"} in trash will be permanently removed and can't be restored.`}
          confirmLabel="Empty trash"
          busy={busy}
          onConfirm={confirmEmpty}
          onCancel={() => setEmptyConfirm(false)}
        />
      )}
    </div>
  );
}
