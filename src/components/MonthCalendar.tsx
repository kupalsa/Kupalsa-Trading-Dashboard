import { buildCalendarWeeks, dailyR } from "../lib/stats";
import type { Trade } from "../lib/types";

interface Props {
  year: number;
  month: number; // 1-12
  trades: Trade[];
}

export default function MonthCalendar({ year, month, trades }: Props) {
  const weeks = buildCalendarWeeks(year, month);
  const perDay = dailyR(trades);

  return (
    <div className="calendar">
      <div className="calendar-header">
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
      </div>
      {weeks.map((week, wi) => (
        <div className="calendar-week" key={wi}>
          {week.map((date, di) => {
            if (!date) return <div className="day-cell empty" key={di} />;
            const r = perDay.get(date);
            const dayNum = Number(date.split("-")[2]);
            const cls =
              r === undefined || r === 0 ? "day-cell" : r > 0 ? "day-cell win-day" : "day-cell loss-day";
            return (
              <div className={cls} key={di}>
                <div className="date-num">{dayNum}</div>
                {r !== undefined && <div className="r-value">{r > 0 ? "+" : ""}{r.toFixed(2)}R</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
