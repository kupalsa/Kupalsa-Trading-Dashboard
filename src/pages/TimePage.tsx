import { useMemo, useState } from "react";
import { useData } from "../lib/DataContext";
import { useActiveTimer } from "../lib/activeTimer";
import ConfirmDialog from "../components/ConfirmDialog";
import { formatDate } from "../lib/stats";
import {
  discardOpenSegment,
  finish,
  formatDuration,
  formatHours,
  isRunning,
  manualSession,
  msByCategoryForMonth,
  msByDay,
  segmentMs,
  sessionMs,
  staleOpenSegment,
  trimToLastSeen,
  type TimeSession,
} from "../lib/timeTracking";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "14:00–15:30, 16:00–16:45" — the actual shape of the session. */
function segmentRanges(session: TimeSession): string {
  return session.segments
    .map((s) => `${clockTime(s.start)}–${s.end ? clockTime(s.end) : "…"}`)
    .join(", ");
}

export default function TimePage() {
  const { timeDoc, githubReady, loading, saveTimeSession, deleteTimeSession, addTimeCategory } =
    useData();
  const { active, now, start, pause, resume, take, set } = useActiveTimer();

  const [category, setCategory] = useState(timeDoc.categories[0] ?? "Backtest");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TimeSession | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  // Manual entry
  const [mDate, setMDate] = useState(() => formatDate(new Date()));
  const [mStart, setMStart] = useState("");
  const [mEnd, setMEnd] = useState("");
  const [mCategory, setMCategory] = useState(timeDoc.categories[0] ?? "Backtest");
  const [mNote, setMNote] = useState("");

  const stale = staleOpenSegment(active, now);

  const byCategory = useMemo(
    () => msByCategoryForMonth(timeDoc.sessions, year, month, now),
    [timeDoc.sessions, year, month, now],
  );
  const monthTotal = byCategory.reduce((sum, r) => sum + r.ms, 0);
  const busiest = byCategory[0]?.ms ?? 0;

  const monthSessions = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return timeDoc.sessions
      .filter((s) => s.segments.some((seg) => seg.start.slice(0, 7) === prefix))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [timeDoc.sessions, year, month]);

  const todayMs = useMemo(
    () => msByDay(timeDoc.sessions, now).get(formatDate(now)) ?? 0,
    [timeDoc.sessions, now],
  );

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; } else if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  /** Writes the session first; the local timer is only cleared once it's stored. */
  async function persistAndClear(session: TimeSession) {
    if (sessionMs(session) === 0) {
      take();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveTimeSession({ ...session, note });
      take();
      setNote("");
    } catch (e) {
      // Keep the timer exactly where it is — losing the session would be
      // worse than showing an error.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    if (!active) return;
    await persistAndClear(finish(active, new Date()));
  }

  async function handleAddCategory() {
    const clean = newCategory.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      await addTimeCategory(clean);
      setCategory(clean);
      setNewCategory("");
      setAddingCategory(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleManualAdd() {
    const session = manualSession(mCategory, mDate, mStart, mEnd, mNote);
    if (!session) {
      setError("Fill in the date and both times.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveTimeSession(session);
      setMStart("");
      setMEnd("");
      setMNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteTimeSession(deleting.id);
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!githubReady) {
    return <div className="panel">Connect GitHub in Settings to track time.</div>;
  }

  const running = active ? isRunning(active) : false;
  const elapsed = active ? sessionMs(active, now) : 0;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Time</h1>
        {loading && <span className="muted">Loading…</span>}
      </div>

      {error && <div className="notice bad">{error}</div>}

      <div className={active ? "panel timer-panel active" : "panel timer-panel"}>
        <h2>{active ? active.category : "Timer"}</h2>

        <div className="timer-readout">{formatDuration(elapsed)}</div>
        <div className="small-note" style={{ marginBottom: 14 }}>
          {active
            ? running
              ? "Running"
              : "Paused"
            : `Nothing running · ${formatHours(todayMs)} logged today`}
        </div>

        {!active && (
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="field" style={{ minWidth: 180 }}>
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {timeDoc.categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {addingCategory ? (
              <div className="field" style={{ minWidth: 180 }}>
                <label>New category</label>
                <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                  <input
                    autoFocus
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Market prep"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCategory();
                      if (e.key === "Escape") { setAddingCategory(false); setNewCategory(""); }
                    }}
                  />
                  <button onClick={handleAddCategory} disabled={busy || !newCategory.trim()}>
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingCategory(true)}>+ Category</button>
            )}
          </div>
        )}

        {active && (
          <div className="field" style={{ marginBottom: 12, maxWidth: 460 }}>
            <label>Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What are you working on?"
            />
          </div>
        )}

        <div className="row">
          {!active && (
            <button className="primary" onClick={() => start(category)} disabled={busy}>
              Start
            </button>
          )}
          {active && running && (
            <button onClick={pause} disabled={busy}>Pause</button>
          )}
          {active && !running && (
            <button className="primary" onClick={resume} disabled={busy}>Resume</button>
          )}
          {active && (
            <button className="danger" onClick={handleEnd} disabled={busy}>
              {busy ? "Saving…" : "End session"}
            </button>
          )}
          {active && <span className="small-note">{segmentRanges(active)}</span>}
        </div>
      </div>

      <div className="panel">
        <h2>
          Monthly summary
          <span className="row" style={{ marginLeft: "auto", gap: 6, flexWrap: "nowrap" }}>
            <button onClick={() => shiftMonth(-1)}>←</button>
            <span className="small-note" style={{ minWidth: 108, textAlign: "center" }}>
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={() => shiftMonth(1)}>→</button>
          </span>
        </h2>

        {byCategory.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No time logged this month.</p>
        ) : (
          <>
            <div className="time-total">{formatHours(monthTotal)}</div>
            {byCategory.map((row) => (
              <div className="time-row" key={row.category}>
                <span className="time-row-name">{row.category}</span>
                <span className="time-bar">
                  <span
                    className="time-bar-fill"
                    style={{ width: `${busiest ? (row.ms / busiest) * 100 : 0}%` }}
                  />
                </span>
                <span className="time-row-value">{formatHours(row.ms)}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="panel">
        <h2>Sessions ({monthSessions.length})</h2>
        {monthSessions.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Nothing logged for this month yet.</p>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Times</th>
                  <th>Duration</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {monthSessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.segments[0] ? formatDate(new Date(s.segments[0].start)) : "—"}</td>
                    <td>{s.category}</td>
                    <td className="muted">{segmentRanges(s)}</td>
                    <td>{formatHours(sessionMs(s, now))}</td>
                    <td className="muted">{s.note || "—"}</td>
                    <td>
                      <button className="danger" onClick={() => setDeleting(s)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Add manually</h2>
        <p className="small-note" style={{ marginTop: 0 }}>
          For the sessions you finish before remembering to press Start. An end time earlier than
          the start reads as running past midnight.
        </p>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ minWidth: 150 }}>
            <label>Category</label>
            <select value={mCategory} onChange={(e) => setMCategory(e.target.value)}>
              {timeDoc.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
          </div>
          <div className="field">
            <label>From</label>
            <input type="time" value={mStart} onChange={(e) => setMStart(e.target.value)} />
          </div>
          <div className="field">
            <label>To</label>
            <input type="time" value={mEnd} onChange={(e) => setMEnd(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>Note</label>
            <input value={mNote} onChange={(e) => setMNote(e.target.value)} placeholder="Optional" />
          </div>
          <button onClick={handleManualAdd} disabled={busy}>Add session</button>
        </div>
      </div>

      {stale && active && (
        <div className="modal-backdrop">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Timer left running</h2>
            <p>
              A <strong>{active.category}</strong> session has been running since{" "}
              {clockTime(stale.start)} — that's {formatHours(segmentMs(stale, now))}. The app was
              last open at {active.lastSeen ? clockTime(active.lastSeen) : "an unknown time"}.
            </p>
            <div className="row">
              <button onClick={() => set({ ...active, lastSeen: new Date().toISOString() })}>
                Keep it all
              </button>
              <button
                className="primary"
                disabled={!active.lastSeen}
                onClick={() => persistAndClear(trimToLastSeen(active))}
              >
                Trim to {active.lastSeen ? clockTime(active.lastSeen) : "last seen"}
              </button>
              <button
                className="danger"
                onClick={() => {
                  const kept = discardOpenSegment(active);
                  if (sessionMs(kept) > 0) persistAndClear(kept);
                  else take();
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this session?"
          message={`${deleting.category} · ${formatHours(sessionMs(deleting, now))} will be permanently removed.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
