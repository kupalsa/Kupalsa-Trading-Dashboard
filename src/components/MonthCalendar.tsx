import { buildCalendarWeeks, dailyR } from "../lib/stats";
import { isTradingDay } from "../lib/session";
import { isAdherent, type DailyReview } from "../lib/types";
import type { Trade } from "../lib/types";
import type { Strategy } from "../lib/strategy";

interface Props {
  year: number;
  month: number; // 1-12
  trades: Trade[];
  /** When provided, each day is also marked adherent / not adherent. */
  reviews?: DailyReview[];
  /** Needed to tell which past days should have had a review but don't. */
  strategies?: Strategy[];
  showAdherence?: boolean;
  showR?: boolean;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MonthCalendar({
  year,
  month,
  trades,
  reviews = [],
  strategies = [],
  showAdherence = false,
  showR = true,
}: Props) {
  const weeks = buildCalendarWeeks(year, month);
  const perDay = dailyR(trades);
  const today = todayStr();

  // A date can hold reviews from several strategies; a day only counts as
  // adherent when every strategy trading that day has a logged, adherent
  // review — a trading day with no review at all counts as not adherent too.
  const adherenceByDate = new Map<string, boolean>();
  if (showAdherence) {
    const reviewByKey = new Map<string, DailyReview>();
    for (const r of reviews) reviewByKey.set(`${r.strategyId}|${r.date}`, r);

    for (const week of weeks) {
      for (const date of week) {
        if (!date || date > today) continue;
        const [y, m, d] = date.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);

        let dayAdherent: boolean | undefined;
        for (const s of strategies) {
          const created = new Date(s.createdAt);
          const createdDate = new Date(created.getFullYear(), created.getMonth(), created.getDate());
          if (createdDate > dateObj || !isTradingDay(dateObj, s.schedule)) continue;
          const r = reviewByKey.get(`${s.id}|${date}`);
          const ok = r ? isAdherent(r) : false;
          dayAdherent = dayAdherent === undefined ? ok : dayAdherent && ok;
        }
        if (dayAdherent !== undefined) adherenceByDate.set(date, dayAdherent);
      }
    }
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div className="calendar-week" key={wi}>
          {week.map((date, di) => {
            if (!date) return <div className="day-cell empty" key={di} />;

            const r = perDay.get(date);
            const dayNum = Number(date.split("-")[2]);
            const isWeekend = di >= 5;
            const adherent = adherenceByDate.get(date);

            const classes = ["day-cell"];
            if (isWeekend) classes.push("weekend");
            if (showR && r !== undefined && r !== 0) classes.push(r > 0 ? "win-day" : "loss-day");
            if (date === today) classes.push("today");
            if (showAdherence && adherent !== undefined) {
              classes.push(adherent ? "adherent" : "not-adherent");
            }

            return (
              <div className={classes.join(" ")} key={di}>
                <div className="date-num">{dayNum}</div>
                {showR && r !== undefined && (
                  <div className="r-value">
                    {r > 0 ? "+" : ""}
                    {r.toFixed(2)}R
                  </div>
                )}
                {showAdherence && adherent !== undefined && (
                  <div className={adherent ? "adherence-mark ok" : "adherence-mark bad"}>
                    {adherent ? "✓" : "✕"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
