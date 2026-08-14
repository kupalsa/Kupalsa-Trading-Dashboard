import { useMemo, useState } from "react";
import { buildCalendarWeeks } from "../lib/stats";
import { isTradingDay } from "../lib/session";
import { isAdherent, type DailyReview } from "../lib/types";
import type { Strategy } from "../lib/strategy";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  strategy: Strategy;
  reviews: DailyReview[];
  selectedDate: string;
  onPick: (date: string) => void;
}

/**
 * A month at a glance for logging: only this strategy's trading days are
 * actionable, and each shows whether it was logged and whether it was adherent.
 */
export default function ReviewMiniCalendar({ strategy, reviews, selectedDate, onPick }: Props) {
  const initial = selectedDate || todayStr();
  const [year, setYear] = useState(Number(initial.slice(0, 4)));
  const [month, setMonth] = useState(Number(initial.slice(5, 7)));

  const byDate = useMemo(() => {
    const m = new Map<string, DailyReview>();
    for (const r of reviews) if (r.strategyId === strategy.id) m.set(r.date, r);
    return m;
  }, [reviews, strategy.id]);

  const weeks = buildCalendarWeeks(year, month);
  const today = todayStr();

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    else if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  return (
    <div className="mini-cal">
      <div className="mini-cal-head">
        <button type="button" onClick={() => shift(-1)}>‹</button>
        <span>{MONTH_NAMES[month - 1]} {year}</span>
        <button type="button" onClick={() => shift(1)}>›</button>
      </div>

      <div className="mini-cal-grid mini-cal-labels">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div className="mini-cal-grid" key={wi}>
          {week.map((date, di) => {
            if (!date) return <div className="mini-day empty" key={di} />;

            const [y, m, d] = date.split("-").map(Number);
            const trading = isTradingDay(new Date(y, m - 1, d), strategy.schedule);
            const review = byDate.get(date);

            const classes = ["mini-day"];
            if (!trading) classes.push("off");
            else if (review) classes.push(isAdherent(review) ? "logged-ok" : "logged-bad");
            else if (date <= today) classes.push("missing");
            if (date === selectedDate) classes.push("selected");
            if (date === today) classes.push("today");

            return (
              <button
                type="button"
                key={di}
                className={classes.join(" ")}
                onClick={() => onPick(date)}
                title={
                  !trading
                    ? `${date} — not a trading day`
                    : review
                      ? `${date} — logged, ${isAdherent(review) ? "adherent" : "not adherent"}`
                      : `${date} — not logged`
                }
              >
                <span>{Number(date.split("-")[2])}</span>
              </button>
            );
          })}
        </div>
      ))}

      <div className="mini-cal-legend">
        <span><i className="swatch logged-ok" /> Adherent</span>
        <span><i className="swatch logged-bad" /> Not adherent</span>
        <span><i className="swatch missing" /> Not logged</span>
      </div>
    </div>
  );
}
