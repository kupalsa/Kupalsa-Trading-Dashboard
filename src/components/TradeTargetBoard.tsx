import { useMemo } from "react";
import { useData } from "../lib/DataContext";
import type { Strategy } from "../lib/strategy";
import {
  currentPeriod,
  parseRTarget,
  projectedNetR,
  requiredWins,
  tradesInPeriod,
} from "../lib/tradeTarget";

function fmtR(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

/**
 * The period's trades as a row of slots: one per trade you plan to take.
 * Filled slots show what actually happened; the still-empty slots you need to
 * win to finish green are marked as targets. The point is to see, before
 * taking a setup, how few good ones you have left to spend.
 */
export default function TradeTargetBoard({ strategy }: { strategy: Strategy }) {
  const { trades } = useData();
  const target = strategy.tradeTarget;

  const rTarget = parseRTarget(strategy.definition.minimalRTarget);

  const period = useMemo(
    () => (target ? currentPeriod(target.cadence) : null),
    [target],
  );

  const taken = useMemo(
    () => (period ? tradesInPeriod(trades, strategy.id, period) : []),
    [trades, strategy.id, period],
  );

  if (!target || !period) return null;

  const needed = requiredWins(target.count, rTarget);
  const wins = taken.filter((t) => t.result === "W").length;
  const netR = taken.reduce((sum, t) => sum + t.rr, 0);

  const winsLeft = needed === null ? 0 : Math.max(0, needed - wins);
  const slotsLeft = Math.max(0, target.count - taken.length);
  // Extra trades beyond the plan still get shown — the target is a guide, not a gate.
  const overflow = taken.slice(target.count);
  const planned = taken.slice(0, target.count);

  return (
    <div className="trade-target">
      <div className="trade-target-head">
        <span className="trade-target-title">
          Trade target · {period.label}
        </span>
        <span className="trade-target-count">
          {taken.length} / {target.count} taken
          <span className={netR > 0 ? "tt-pos" : netR < 0 ? "tt-neg" : "muted"}>
            {" "}· net {fmtR(netR)}R
          </span>
        </span>
      </div>

      <div className="trade-target-slots">
        {planned.map((t) => (
          <div
            key={t.id}
            className={`tt-slot filled ${t.result === "W" ? "win" : t.result === "L" ? "loss" : "be"}`}
            title={`${t.date} · ${t.direction} · ${fmtR(t.rr)}R`}
          >
            {fmtR(t.rr)}
          </div>
        ))}

        {Array.from({ length: slotsLeft }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className={i < winsLeft ? "tt-slot target" : "tt-slot"}
            title={
              i < winsLeft
                ? `Needs to win${rTarget ? ` at ${rTarget}R` : ""} to hit the target`
                : "Open slot"
            }
          >
            {i < winsLeft && rTarget ? `${rTarget}R` : ""}
          </div>
        ))}

        {overflow.map((t) => (
          <div
            key={t.id}
            className={`tt-slot filled over ${t.result === "W" ? "win" : t.result === "L" ? "loss" : "be"}`}
            title={`${t.date} · beyond the planned ${target.count}`}
          >
            {fmtR(t.rr)}
          </div>
        ))}
      </div>

      <div className="trade-target-note">
        {needed === null ? (
          <>
            Set a <strong>Minimal R target</strong> on the strategy to see how many of these need to
            win.
          </>
        ) : wins >= needed ? (
          <>
            <span className="tt-pos">Target met</span> — {wins} of {needed} wins needed.
            {slotsLeft > 0 && ` ${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} still open.`}
          </>
        ) : (
          <>
            Need <strong>{needed}</strong> win{needed === 1 ? "" : "s"} at {rTarget}R out of{" "}
            {target.count} to finish profitable
            {` (+${projectedNetR(target.count, rTarget!, needed).toFixed(0)}R)`} — {wins} so far,{" "}
            <strong>{winsLeft}</strong> to go.
          </>
        )}
      </div>
    </div>
  );
}
