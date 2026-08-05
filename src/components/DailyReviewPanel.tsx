import { useEffect, useState } from "react";
import { useData } from "../lib/DataContext";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyReviewPanel() {
  const { dailyReviews, saveDailyReview } = useData();
  const [date, setDate] = useState(todayStr());
  const [followedRules, setFollowedRules] = useState(false);
  const [tookGoodTrades, setTookGoodTrades] = useState(false);
  const [focusedAndCalm, setFocusedAndCalm] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = dailyReviews.find((r) => r.date === date);
    setFollowedRules(existing?.followedRules ?? false);
    setTookGoodTrades(existing?.tookGoodTrades ?? false);
    setFocusedAndCalm(existing?.focusedAndCalm ?? false);
    setNotes(existing?.notes ?? "");
    setSaved(false);
  }, [date, dailyReviews]);

  const adherent = followedRules && tookGoodTrades && focusedAndCalm;

  async function handleSave() {
    setSaving(true);
    try {
      await saveDailyReview({ date, followedRules, tookGoodTrades, focusedAndCalm, notes });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>End of Day Review</h2>
      <div className="field" style={{ marginBottom: 10, maxWidth: 180 }}>
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="checkbox-row" style={{ marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={followedRules}
          onChange={(e) => setFollowedRules(e.target.checked)}
          id="rules"
        />
        <label htmlFor="rules">I followed my rules today</label>
      </div>
      <div className="checkbox-row" style={{ marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={tookGoodTrades}
          onChange={(e) => setTookGoodTrades(e.target.checked)}
          id="good-trades"
        />
        <label htmlFor="good-trades">I took good trades</label>
      </div>
      <div className="checkbox-row" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={focusedAndCalm}
          onChange={(e) => setFocusedAndCalm(e.target.checked)}
          id="focused"
        />
        <label htmlFor="focused">I was focused and calm</label>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
      </div>

      <div className="row">
        <span className={adherent ? "pill win" : "pill loss"}>{adherent ? "Adherent" : "Not adherent"}</span>
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save review"}
        </button>
        {saved && <span className="success-text">Saved</span>}
      </div>
    </div>
  );
}
