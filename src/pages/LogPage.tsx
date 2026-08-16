import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { isTradingDay } from "../lib/session";
import LiveSessionPanel from "../components/LiveSessionPanel";
import TradeForm from "../components/TradeForm";
import TradeTable from "../components/TradeTable";
import DailyReviewPanel from "../components/DailyReviewPanel";
import type { Strategy } from "../lib/strategy";

export default function LogPage() {
  const { githubReady, loading, error, strategies, selectedIds } = useData();
  const [pasteTarget, setPasteTarget] = useState<string | null>(null);

  const selected = useMemo(
    () => strategies.filter((s) => selectedIds.includes(s.id)),
    [strategies, selectedIds],
  );

  const now = new Date();
  const todays = useMemo(
    () => selected.filter((s) => isTradingDay(now, s.schedule)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, now.getDay()],
  );

  if (!githubReady) {
    return (
      <div className="panel">
        <h2>Connect GitHub first</h2>
        <p>
          Head to <Link to="/settings">Settings</Link> and add your GitHub username, repository, and a
          Personal Access Token so trades can be saved.
        </p>
      </div>
    );
  }

  // Every selected strategy gets a column, trading day or not: a session or
  // trade missed earlier in the week has to be loggable after the fact. The
  // live panel is the only genuinely day-specific piece, so it's the one thing
  // that drops out on an off day.
  const columns: Strategy[] = selected;
  const activePaste = pasteTarget ?? columns[0]?.id ?? null;

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Trade Log</h1>
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      {todays.length === 0 && (
        <div className="panel">
          <h2>Nothing scheduled today</h2>
          <p className="muted" style={{ margin: 0 }}>
            {selected.length === 0
              ? "No strategy selected."
              : `${selected.map((s) => s.name).join(" and ")} ${
                  selected.length === 1 ? "does not trade" : "do not trade"
                } today — so there is no live session below. You can still catch up on anything you missed: set the date on either form to a past day.`}
          </p>
        </div>
      )}

      <div className={columns.length > 1 ? "log-columns multi" : "log-columns"}>
        {columns.map((s) => (
          <section
            key={s.id}
            className="log-column"
            onFocusCapture={() => setPasteTarget(s.id)}
            onMouseDown={() => setPasteTarget(s.id)}
          >
            {columns.length > 1 && (
              <div className="log-column-head">
                <span className={activePaste === s.id ? "col-name active" : "col-name"}>{s.name}</span>
                {activePaste === s.id && <span className="small-note">paste goes here</span>}
              </div>
            )}
            {isTradingDay(now, s.schedule) && <LiveSessionPanel strategy={s} />}
            <TradeForm strategy={s} acceptPaste={activePaste === s.id} />
            <DailyReviewPanel strategy={s} />
          </section>
        ))}
      </div>

      <div className="panel">
        <h2>
          Recent Trades
          {selected.length > 1 && (
            <span className="small-note">{selected.map((s) => s.name).join(" + ")}</span>
          )}
        </h2>
        <TradeTable strategyIds={selectedIds} />
      </div>
    </div>
  );
}
