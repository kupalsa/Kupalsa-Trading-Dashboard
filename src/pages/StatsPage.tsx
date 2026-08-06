import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import MonthCalendar from "../components/MonthCalendar";
import { adherentRate, reviewsForMonth, summarize, tradesForMonth } from "../lib/stats";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function StatsPage() {
  const { trades, dailyReviews, githubReady, loading } = useData();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const monthTrades = useMemo(() => tradesForMonth(trades, year, month), [trades, year, month]);
  const summary = useMemo(() => summarize(monthTrades), [monthTrades]);
  const overall = useMemo(() => summarize(trades), [trades]);

  const monthReviews = useMemo(() => reviewsForMonth(dailyReviews, year, month), [dailyReviews, year, month]);
  const monthAdherence = useMemo(() => adherentRate(monthReviews), [monthReviews]);
  const overallAdherence = useMemo(() => adherentRate(dailyReviews), [dailyReviews]);

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

  if (!githubReady) {
    return <div className="panel">Connect GitHub in Settings to see stats.</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Stats</h1>
      {loading && <p className="muted">Loading…</p>}

      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div className="row">
            <button onClick={() => shiftMonth(-1)}>&larr;</button>
            <h2 style={{ margin: 0, textTransform: "none", fontSize: 16, color: "var(--text)" }}>
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button onClick={() => shiftMonth(1)}>&rarr;</button>
          </div>
        </div>
        <MonthCalendar year={year} month={month} trades={monthTrades} />

        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="stat-tile">
            <div className="label">Total R (month)</div>
            <div className="value" style={{ color: summary.totalR >= 0 ? "var(--green)" : "var(--red)" }}>
              {summary.totalR.toFixed(2)}
            </div>
          </div>
          <div className="stat-tile">
            <div className="label">Win Rate</div>
            <div className="value">{summary.winRate.toFixed(0)}%</div>
          </div>
          <div className="stat-tile">
            <div className="label">Trades</div>
            <div className="value">{summary.numTrades}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Avg R / Trade</div>
            <div className="value">{summary.avgR.toFixed(2)}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Winning Days</div>
            <div className="value" style={{ color: "var(--green)" }}>{summary.winningDays}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Losing Days</div>
            <div className="value" style={{ color: "var(--red)" }}>{summary.losingDays}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Adherent Sessions</div>
            <div className="value">{monthReviews.length ? `${monthAdherence.toFixed(0)}%` : "—"}</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>All-time Overview</h2>
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="label">Total R</div>
            <div className="value" style={{ color: overall.totalR >= 0 ? "var(--green)" : "var(--red)" }}>
              {overall.totalR.toFixed(2)}
            </div>
          </div>
          <div className="stat-tile">
            <div className="label">Win Rate</div>
            <div className="value">{overall.winRate.toFixed(0)}%</div>
          </div>
          <div className="stat-tile">
            <div className="label">Total Trades</div>
            <div className="value">{overall.numTrades}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Trades / Week</div>
            <div className="value">{overall.tradesPerWeek.toFixed(1)}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Adherent Sessions</div>
            <div className="value">{dailyReviews.length ? `${overallAdherence.toFixed(0)}%` : "—"}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Avg Trade Duration</div>
            <div className="value">{overall.avgTradeDuration}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Max Win Streak</div>
            <div className="value">{overall.maxWinStreak}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Max Loss Streak</div>
            <div className="value">{overall.maxLossStreak}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Avg Entry Hour</div>
            <div className="value">{overall.avgEntryHour}</div>
          </div>
          <div className="stat-tile">
            <div className="label">Avg Exit Hour</div>
            <div className="value">{overall.avgExitHour}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
