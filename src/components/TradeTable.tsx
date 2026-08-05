import { useData } from "../lib/DataContext";
import { screenshotUrl } from "../lib/githubStore";

function resultPillClass(result: string): string {
  if (result === "W") return "pill win";
  if (result === "L") return "pill loss";
  return "pill be";
}

export default function TradeTable() {
  const { trades, deleteTrade, settings } = useData();
  const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  if (sorted.length === 0) {
    return <p className="muted">No trades logged yet.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
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
        {sorted.map((t) => (
          <tr key={t.id}>
            <td>{t.date}</td>
            <td>{t.day}</td>
            <td>{t.entryTime || "—"}</td>
            <td>{t.exitTime || "—"}</td>
            <td>
              <span className={t.direction === "Long" ? "pill long" : "pill short"}>{t.direction}</span>
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
                <a href={screenshotUrl(settings, t.screenshotPath)} target="_blank" rel="noreferrer">
                  view
                </a>
              ) : (
                "—"
              )}
            </td>
            <td className="muted">{t.note || "—"}</td>
            <td>
              <button onClick={() => deleteTrade(t.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
