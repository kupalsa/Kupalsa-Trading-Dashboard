import { useMemo, useRef, useState } from "react";
import { useData } from "../lib/DataContext";
import { compressImage, dataUrlToBase64 } from "../lib/image";
import {
  backtestEntryImagePath,
  newBacktestEntry,
  type BacktestEntry,
} from "../lib/backtestEntry";
import RepoImage, { useRepoImage } from "./RepoImage";
import ConfirmDialog from "./ConfirmDialog";

/** A stored screenshot thumbnail; clicking it opens the full image. */
function Thumb({ path, onOpen }: { path: string; onOpen: () => void }) {
  const { url, loading, error } = useRepoImage(path);
  if (loading) return <span className="small-note">…</span>;
  if (error || !url) return <span className="muted">unavailable</span>;
  return (
    <button type="button" className="shot-thumb" onClick={onOpen} title="Open screenshot">
      <img src={url} alt="Backtest screenshot" />
    </button>
  );
}

function EntryCard({
  entry,
  onDelete,
}: {
  entry: BacktestEntry;
  onDelete: () => void;
}) {
  const { saveBacktestEntry, saveBacktestScreenshot } = useData();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState(entry.text);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const dirty = text !== entry.text;

  async function handleFiles(files: FileList) {
    setError(null);
    setBusy(true);
    try {
      const paths = [...entry.screenshotPaths];
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        // Index by current length so re-adding after a removal can't collide.
        const path = backtestEntryImagePath(entry.id, paths.length);
        await saveBacktestScreenshot(path, dataUrlToBase64(compressed));
        paths.push(path);
      }
      await saveBacktestEntry({ ...entry, screenshotPaths: paths, text });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeShot(path: string) {
    setError(null);
    setBusy(true);
    try {
      await saveBacktestEntry({
        ...entry,
        screenshotPaths: entry.screenshotPaths.filter((p) => p !== path),
        text,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveText() {
    setError(null);
    setSaving(true);
    try {
      await saveBacktestEntry({ ...entry, text });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="backtest-entry">
      <div className="backtest-entry-head">
        <span className="backtest-seq">#{entry.seq}</span>
        <span className="small-note">{entry.createdAt.slice(0, 10)}</span>
        <button className="danger" type="button" onClick={onDelete} style={{ marginLeft: "auto" }}>
          Delete
        </button>
      </div>

      <div className="backtest-entry-body">
        <div className="backtest-shots">
          <div className="shot-grid">
            {entry.screenshotPaths.map((p) => (
              <div className="shot-cell" key={p}>
                <Thumb path={p} onOpen={() => setViewing(p)} />
                <button
                  type="button"
                  className="shot-remove"
                  title="Remove screenshot"
                  onClick={() => removeShot(p)}
                  disabled={busy}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="shot-add"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {busy ? "…" : "+ Screenshot"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div className="backtest-text">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the Trade Logger output here…"
            onPaste={(e) => e.stopPropagation()}
          />
          <div className="row" style={{ marginTop: 6 }}>
            <button type="button" onClick={saveText} disabled={!dirty || saving}>
              {saving ? "Saving…" : dirty ? "Save text" : "Saved"}
            </button>
            {error && <span className="error-text">{error}</span>}
          </div>
        </div>
      </div>

      {viewing && (
        <div className="modal-backdrop" onClick={() => setViewing(null)}>
          <div className="modal shot-modal" onClick={(e) => e.stopPropagation()}>
            <RepoImage path={viewing} alt="Backtest screenshot" className="screenshot-full" />
            <div className="row" style={{ marginTop: 14 }}>
              <button onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BacktestEntryList({ strategyId }: { strategyId: string }) {
  const { backtestEntries, saveBacktestEntry, deleteBacktestEntry } = useData();
  const [deleting, setDeleting] = useState<BacktestEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const entries = useMemo(
    () =>
      backtestEntries
        .filter((e) => e.strategyId === strategyId)
        .sort((a, b) => b.seq - a.seq),
    [backtestEntries, strategyId],
  );

  const nextSeq = useMemo(
    () => entries.reduce((max, e) => Math.max(max, e.seq), 0) + 1,
    [entries],
  );

  async function addEntry() {
    setAdding(true);
    try {
      await saveBacktestEntry(newBacktestEntry(nextSeq, strategyId));
    } finally {
      setAdding(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteBacktestEntry(deleting.id);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>
        Backtest Trades ({entries.length})
        <button
          className="primary"
          style={{ marginLeft: "auto" }}
          onClick={addEntry}
          disabled={adding}
        >
          {adding ? "Adding…" : `+ Add #${nextSeq}`}
        </button>
      </h2>

      {entries.length === 0 && (
        <p className="muted" style={{ margin: 0 }}>
          Nothing logged yet. Add an entry, drop in screenshots, and paste the Trade Logger output.
        </p>
      )}

      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} onDelete={() => setDeleting(e)} />
      ))}

      {deleting && (
        <ConfirmDialog
          title="Delete this entry?"
          message={`Backtest entry #${deleting.seq} will be permanently removed.`}
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
