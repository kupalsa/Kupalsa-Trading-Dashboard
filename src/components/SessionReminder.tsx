import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../lib/DataContext";
import { loadDismissed, saveDismissed, sessionNeedingReview } from "../lib/sessionReminder";
import { dayOfWeek } from "../lib/stats";

export default function SessionReminder() {
  const { dailyReviews, githubReady, loading } = useData();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<string | null>(() => loadDismissed());

  const pending = useMemo(() => {
    if (!githubReady || loading) return null;
    return sessionNeedingReview(
      new Date(),
      dailyReviews.map((r) => r.date),
      dismissed,
    );
  }, [dailyReviews, githubReady, loading, dismissed]);

  if (!pending) return null;

  function dismiss() {
    if (!pending) return;
    saveDismissed(pending);
    setDismissed(pending);
  }

  const isToday = pending === new Date().toISOString().slice(0, 10);

  return (
    <div className="modal-backdrop" onClick={dismiss}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Session not logged</h2>
        <p>
          {isToday ? "Today's" : `${dayOfWeek(pending)}'s`} session ({pending}) doesn&rsquo;t have an
          end-of-day review yet. Logging it while it&rsquo;s fresh keeps the adherence record honest.
        </p>
        <div className="row">
          <button onClick={dismiss}>Not now</button>
          <button
            className="primary"
            onClick={() => {
              dismiss();
              navigate("/");
            }}
          >
            Log it now
          </button>
        </div>
      </div>
    </div>
  );
}
