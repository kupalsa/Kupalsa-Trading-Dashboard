import { useEffect, useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import MonthCalendar from "../components/MonthCalendar";
import {
  adherenceForRange,
  earliestActivityDate,
  monthsSince,
  reviewsForMonth,
  summarize,
  tradesForMonth,
} from "../lib/stats";
import { MAX_ZOOM, MIN_ZOOM, useUiZoom } from "../lib/useUiZoom";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { trades: allTrades, dailyReviews: allReviews, githubReady, loading, strategies, selectedIds } =
    useData();

  // Stats is the one place data from several strategies merges.
  const trades = useMemo(
    () => allTrades.filter((t) => selectedIds.includes(t.strategyId)),
    [allTrades, selectedIds],
  );
  const dailyReviews = useMemo(
    () => allReviews.filter((r) => selectedIds.includes(r.strategyId)),
    [allReviews, selectedIds],
  );
  const scopedStrategies = useMemo(
    () => strategies.filter((s) => selectedIds.includes(s.id)),
    [strategies, selectedIds],
  );

  // Adherence should be judged from when a strategy was actually traded, not
  // from whenever its record happened to be (re)created in the app — a
  // strategy carried over from before the multi-strategy feature existed
  // otherwise looks freshly created and its whole trading history goes
  // unjudged. Override createdAt with the earliest real activity instead.
  const adherenceStrategies = useMemo(
    () =>
      scopedStrategies.map((s) => {
        const start = earliestActivityDate(s.id, allTrades, allReviews);
        return start ? { ...s, createdAt: `${start}T00:00:00.000Z` } : s;
      }),
    [scopedStrategies, allTrades, allReviews],
  );
  const selectedNames = strategies
    .filter((s) => selectedIds.includes(s.id))
    .map((s) => s.name)
    .join(" + ");
  // Stable for the life of the page: a fresh Date on every render
  // invalidates every memo below it.
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [fitMode, setFitMode] = useState(true);
  const [showAdherence, setShowAdherence] = useState(false);
  const { zoom, setZoom, fit } = useUiZoom();

  const monthTrades = useMemo(() => tradesForMonth(trades, year, month), [trades, year, month]);
  const summary = useMemo(() => summarize(monthTrades), [monthTrades]);
  const overall = useMemo(() => summarize(trades), [trades]);

  const monthReviews = useMemo(
    () => reviewsForMonth(dailyReviews, year, month),
    [dailyReviews, year, month],
  );

  // A trading day with no review at all counts as not adherent, same as one
  // logged with an unchecked box — silence isn't neutral here.
  const monthAdherence = useMemo(() => {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const cutoff = now < monthEnd ? now : monthEnd;
    return adherenceForRange(adherenceStrategies, dailyReviews, monthStart, cutoff);
  }, [adherenceStrategies, dailyReviews, year, month, now]);

  const overallAdherence = useMemo(
    () => adherenceForRange(adherenceStrategies, dailyReviews, new Date(0), now),
    [adherenceStrategies, dailyReviews, now],
  );

  // How long you've actually been trading these strategies, for the "since
  // always" tile — earliest activity across whichever ones are selected.
  const durationMonths = useMemo(() => {
    const starts = scopedStrategies
      .map((s) => earliestActivityDate(s.id, allTrades, allReviews))
      .filter((d): d is string => d !== null);
    if (starts.length === 0) return null;
    const earliest = starts.reduce((min, d) => (d < min ? d : min));
    return monthsSince(earliest, now);
  }, [scopedStrategies, allTrades, allReviews, now]);

  const avgRPerMonth = useMemo(() => {
    if (!durationMonths) return null;
    return overall.totalR / durationMonths;
  }, [overall.totalR, durationMonths]);

  // Re-fit when the data or month changes the content height.
  useEffect(() => {
    if (fitMode) fit();
  }, [fitMode, fit, year, month, trades.length, dailyReviews.length]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    setMonth(m);
    setYear(y);
  }

  function manualZoom(next: number) {
    setFitMode(false);
    setZoom(next);
  }

  if (!githubReady) {
    return <div className="panel">Connect GitHub in Settings to see stats.</div>;
  }

  const rColor = (v: number) => (v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : undefined);

  return (
    <div className={fitMode ? "stats-page fit" : "stats-page"}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <button onClick={() => shiftMonth(-1)}>&larr;</button>
          <h1 style={{ margin: 0, fontSize: 20, minWidth: 168, textAlign: "center" }}>
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          <button onClick={() => shiftMonth(1)}>&rarr;</button>
          <span className="small-note">{selectedNames}</span>
          {loading && <span className="muted">Loading…</span>}
        </div>

        <div className="zoom-controls">
          <button
            className={fitMode ? "active" : ""}
            onClick={() => setFitMode(true)}
            title="Scale so everything fits on screen"
            style={fitMode ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          >
            Fit
          </button>
          <button onClick={() => manualZoom(zoom - 0.1)} disabled={zoom <= MIN_ZOOM}>
            −
          </button>
          <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
          <button onClick={() => manualZoom(zoom + 0.1)} disabled={zoom >= MAX_ZOOM}>
            +
          </button>
          <button onClick={() => manualZoom(1)}>Reset</button>
        </div>
      </div>

      <div className="stats-body">
        <div className="panel">
          <h2>
            Daily R
            <label className="bool-field" style={{ paddingBottom: 0, marginLeft: "auto", fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={showAdherence}
                onChange={(e) => setShowAdherence(e.target.checked)}
              />
              Adherence
            </label>
          </h2>
          <MonthCalendar
            year={year}
            month={month}
            trades={monthTrades}
            reviews={monthReviews}
            strategies={adherenceStrategies}
            showAdherence={showAdherence}
          />
        </div>

        <div className="stats-side">
          <div className="panel">
            <h2>{MONTH_NAMES[month - 1]}</h2>
            <div className="stat-grid">
              <Tile
                label="Total R"
                value={summary.totalR.toFixed(2)}
                color={rColor(summary.totalR)}
              />
              <Tile label="Win Rate" value={`${summary.winRate.toFixed(0)}%`} />
              <Tile label="Trades" value={String(summary.numTrades)} />
              <Tile label="Avg R / Trade" value={summary.avgR.toFixed(2)} />
              <Tile
                label="Winning Days"
                value={String(summary.winningDays)}
                color="var(--green)"
              />
              <Tile label="Losing Days" value={String(summary.losingDays)} color="var(--red)" />
              <Tile
                label="Adherent"
                value={monthAdherence.total ? `${monthAdherence.rate.toFixed(0)}%` : "—"}
              />
            </div>
          </div>

          <div className="panel">
            <h2>All time</h2>
            <div className="stat-grid">
              <Tile
                label="Total R"
                value={overall.totalR.toFixed(2)}
                color={rColor(overall.totalR)}
              />
              <Tile label="Win Rate" value={`${overall.winRate.toFixed(0)}%`} />
              <Tile label="Trades" value={String(overall.numTrades)} />
              <Tile label="Trades / Week" value={overall.tradesPerWeek.toFixed(1)} />
              <Tile
                label="Total Duration"
                value={durationMonths != null ? `${durationMonths.toFixed(1)} mo` : "—"}
              />
              <Tile
                label="Avg R / Month"
                value={avgRPerMonth != null ? avgRPerMonth.toFixed(2) : "—"}
                color={avgRPerMonth != null ? rColor(avgRPerMonth) : undefined}
              />
              <Tile
                label="Adherent"
                value={overallAdherence.total ? `${overallAdherence.rate.toFixed(0)}%` : "—"}
              />
              <Tile label="Avg Duration" value={overall.avgTradeDuration} />
              <Tile label="Max Win Streak" value={String(overall.maxWinStreak)} />
              <Tile label="Max Loss Streak" value={String(overall.maxLossStreak)} />
              <Tile label="Avg Entry" value={overall.avgEntryHour} />
              <Tile label="Avg Exit" value={overall.avgExitHour} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
