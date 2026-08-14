import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import OpportunityForm from "../components/OpportunityForm";
import { RepoImageLink } from "../components/RepoImage";
import {
  attemptedOnly,
  derive,
  emptyOpportunity,
  expectancy,
  isFilled,
  MIN_SAMPLE,
  outcomeOf,
  realisedR,
  SETUP_FAMILY,
  SETUP_TYPES,
  standDownBreakdown,
  type Basis,
  type Opportunity,
  type Population,
  type SetupFamily,
} from "../lib/backtest";

function fmt(v: number | null, dp = 2): string {
  return v == null ? "—" : v.toFixed(dp);
}

function ExpectancyRow({
  label,
  rows,
  basis,
  population,
}: {
  label: string;
  rows: Opportunity[];
  basis: Basis;
  population: Population;
}) {
  const s = expectancy(rows, basis, population);
  if (s.n === 0) return null;
  return (
    <tr className={s.n < MIN_SAMPLE ? "low-sample" : undefined}>
      <td>{label}</td>
      <td>
        {s.n}
        {s.n < MIN_SAMPLE && <span className="small-note"> (low n)</span>}
      </td>
      <td>{s.winRate.toFixed(0)}%</td>
      <td style={{ color: s.totalR >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(s.totalR)}</td>
      <td>{fmt(s.avgR)}</td>
      <td>{s.fillRate.toFixed(0)}%</td>
      <td>{fmt(s.avgMfeR)}</td>
      <td>{fmt(s.avgMaeR)}</td>
    </tr>
  );
}

export default function BacktestPage() {
  const {
    opportunities: allOpportunities,
    githubReady,
    loading,
    deleteOpportunity,
    strategies,
    selectedIds,
  } = useData();
  const [editing, setEditing] = useState<Opportunity | null>(null);

  // Expectancy per setup type is meaningless mixed across strategies, so the
  // backtest always scopes to exactly one.
  const [focusId, setFocusId] = useState<string | null>(null);
  const strategy =
    strategies.find((s) => s.id === focusId) ??
    strategies.find((s) => s.id === selectedIds[0]) ??
    strategies[0];

  const opportunities = useMemo(
    () => allOpportunities.filter((o) => o.strategyId === strategy?.id),
    [allOpportunities, strategy?.id],
  );
  const [basis, setBasis] = useState<Basis>("optimized");
  const [population, setPopulation] = useState<Population>("all");

  const nextSeq = useMemo(
    () => opportunities.reduce((max, o) => Math.max(max, o.seq), 0) + 1,
    [opportunities],
  );

  const attempted = useMemo(() => attemptedOnly(opportunities), [opportunities]);
  const standDowns = useMemo(() => standDownBreakdown(opportunities), [opportunities]);

  const families: SetupFamily[] = ["Reversal", "Continuation"];

  if (!githubReady) {
    return <div className="panel">Connect GitHub in Settings to use the backtest log.</div>;
  }
  if (!strategy) return <div className="panel">Create a strategy first.</div>;

  if (editing) {
    return (
      <div>
        <h1 style={{ marginBottom: 16 }}>Backtest</h1>
        <OpportunityForm initial={editing} nextSeq={nextSeq} onDone={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div className="row">
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
        <button className="primary" onClick={() => setEditing(emptyOpportunity(nextSeq, strategy.id))}>
          + New opportunity
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}

      <div className="panel">
        <h2>Expectancy</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <div>
            <div className="small-note" style={{ marginBottom: 4 }}>Price basis</div>
            <div className="toggle-group">
              <button
                className={basis === "natural" ? "active" : ""}
                onClick={() => setBasis("natural")}
              >
                Natural
              </button>
              <button
                className={basis === "optimized" ? "active" : ""}
                onClick={() => setBasis("optimized")}
              >
                Optimized
              </button>
            </div>
          </div>
          <div>
            <div className="small-note" style={{ marginBottom: 4 }}>Population</div>
            <div className="toggle-group">
              <button
                className={population === "all" ? "active" : ""}
                onClick={() => setPopulation("all")}
              >
                All opportunities
              </button>
              <button
                className={population === "filled" ? "active" : ""}
                onClick={() => setPopulation("filled")}
              >
                Filled only
              </button>
            </div>
          </div>
        </div>

        <p className="small-note" style={{ marginTop: 0 }}>
          {population === "all"
            ? "Unfilled opportunities count as 0R — this captures the cost of entries too tight to fill."
            : "Unfilled opportunities excluded. Compare against 'all opportunities' — they will diverge."}{" "}
          Stand-downs are excluded from both. Rows under {MIN_SAMPLE} samples are dimmed.
        </p>

        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Segment</th>
                <th>n</th>
                <th>Win rate</th>
                <th>Total R</th>
                <th>Avg R</th>
                <th>Fill rate</th>
                <th>Avg MFE</th>
                <th>Avg MAE</th>
              </tr>
            </thead>
            <tbody>
              <ExpectancyRow label="All setups" rows={opportunities} basis={basis} population={population} />
              {families.map((f) => (
                <ExpectancyRow
                  key={f}
                  label={`${f} family`}
                  rows={opportunities.filter((o) => o.setupType && SETUP_FAMILY[o.setupType] === f)}
                  basis={basis}
                  population={population}
                />
              ))}
              {SETUP_TYPES.map((st) => (
                <ExpectancyRow
                  key={st}
                  label={st}
                  rows={opportunities.filter((o) => o.setupType === st)}
                  basis={basis}
                  population={population}
                />
              ))}
            </tbody>
          </table>
        </div>
        {attempted.length === 0 && <p className="muted">No attempted trades logged yet.</p>}
      </div>

      {standDowns.length > 0 && (
        <div className="panel">
          <h2>Stand-downs</h2>
          <p className="small-note" style={{ marginTop: 0 }}>
            The denominator for base-rate analysis: opportunities available but passed on.
          </p>
          <table>
            <thead>
              <tr>
                <th>Reason</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {standDowns.map((s) => (
                <tr key={s.reason}>
                  <td>{s.reason}</td>
                  <td>{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel">
        <h2>Opportunity Log ({opportunities.length})</h2>
        {opportunities.length === 0 ? (
          <p className="muted">No opportunities logged yet.</p>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Setup</th>
                  <th>Dir</th>
                  <th>Phase</th>
                  <th>Arrival</th>
                  <th>Nat R</th>
                  <th>Opt R</th>
                  <th>Filled</th>
                  <th>Outcome</th>
                  <th>Realised R</th>
                  <th>Swing</th>
                  <th>Shots</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => {
                  const d = derive(o);
                  const filled = isFilled(o, basis);
                  const outcome = outcomeOf(o, basis);
                  const r = realisedR(o, basis);
                  const standDown = o.stoodDownType !== "None";
                  return (
                    <tr key={o.id}>
                      <td>{o.seq}</td>
                      <td>{o.date || "—"}</td>
                      <td>{standDown ? <span className="muted">{o.stoodDownType}</span> : o.setupType || "—"}</td>
                      <td>{o.direction || "—"}</td>
                      <td>{o.phaseHTF || "?"}/{o.phaseLTF || "?"}</td>
                      <td>{o.arrival || "—"}</td>
                      <td>{fmt(d.naturalR)}</td>
                      <td>{fmt(d.optimizedR)}</td>
                      <td>{standDown ? "—" : filled ? "Yes" : "No"}</td>
                      <td>{standDown ? "—" : outcome || "—"}</td>
                      <td style={{ color: r > 0 ? "var(--green)" : r < 0 ? "var(--red)" : undefined }}>
                        {standDown ? "—" : fmt(r)}
                      </td>
                      <td>{d.swingValid ?? "—"}</td>
                      <td>
                        {o.screenshots.length === 0
                          ? "—"
                          : o.screenshots.map((s, i) => (
                              <span key={s.path} style={{ marginRight: 6 }}>
                                <RepoImageLink path={s.path}>{i + 1}</RepoImageLink>
                              </span>
                            ))}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button onClick={() => setEditing(o)}>Edit</button>{" "}
                        <button onClick={() => deleteOpportunity(o.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
