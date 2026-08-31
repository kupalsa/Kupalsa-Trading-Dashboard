import { useCallback, useEffect, useState } from "react";
import { useData } from "../lib/DataContext";
import { compressImage } from "../lib/image";
import { dayOfWeek } from "../lib/stats";
import type { Direction, Result, Trade } from "../lib/types";
import ScreenshotDropzone from "./ScreenshotDropzone";
import { useRepoImage } from "./RepoImage";
import type { Strategy } from "../lib/strategy";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm = {
  date: todayStr(),
  entryTime: "",
  exitTime: "",
  direction: "Long" as Direction,
  result: "W" as Result,
  stopPoints: "",
  rr: "",
  note: "",
};

function formFromTrade(t: Trade) {
  return {
    date: t.date,
    entryTime: t.entryTime,
    exitTime: t.exitTime,
    direction: t.direction,
    result: t.result,
    stopPoints: String(t.stopPoints),
    rr: String(t.rr),
    note: t.note,
  };
}

interface Props {
  strategy: Strategy;
  /** With several strategies side by side, only the focused column takes a paste. */
  acceptPaste?: boolean;
  /** Present to edit an existing trade instead of logging a new one. */
  initial?: Trade;
  onDone?: () => void;
}

export default function TradeForm({ strategy, acceptPaste = true, initial, onDone }: Props) {
  const { addTrade, updateTrade, saveScreenshot } = useData();
  const isEdit = Boolean(initial);

  const [form, setForm] = useState(() => (initial ? formFromTrade(initial) : emptyForm));
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  // Whether the screenshot shown differs from what's already saved for this trade.
  const [screenshotChanged, setScreenshotChanged] = useState(false);
  // The stored image is private-repo content, so it has to be fetched with auth.
  const storedShot = useRepoImage(screenshotChanged ? null : initial?.screenshotPath);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const handleFile = useCallback(async (file: File) => {
    setMessage(null);
    const compressed = await compressImage(file);
    setScreenshotDataUrl(compressed);
    setScreenshotChanged(true);
  }, []);

  // Allow pasting a screenshot anywhere on the page, not just inside the dropzone.
  useEffect(() => {
    if (!acceptPaste) return;
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        handleFile(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile, acceptPaste]);

  function resetForm() {
    setForm({ ...emptyForm, date: todayStr() });
    setScreenshotDataUrl(null);
    setScreenshotChanged(false);
  }

  function clearScreenshot() {
    setScreenshotDataUrl(null);
    setScreenshotChanged(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // A screenshot is only mandatory when logging a brand-new trade — edits of
    // older trades (e.g. a bulk import) may legitimately have none.
    if (!isEdit && !screenshotDataUrl) {
      setMessage({ kind: "error", text: "A screenshot is required before saving a trade." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const id = initial?.id ?? crypto.randomUUID();

      let screenshotPath = initial?.screenshotPath ?? null;
      if (screenshotChanged) {
        if (screenshotDataUrl) {
          screenshotPath = `screenshots/${id}.jpg`;
          await saveScreenshot(screenshotPath, screenshotDataUrl.split(",")[1] ?? "");
        } else {
          screenshotPath = null;
        }
      }

      const trade: Trade = {
        id,
        strategyId: strategy.id,
        date: form.date,
        day: dayOfWeek(form.date),
        entryTime: form.entryTime,
        exitTime: form.exitTime,
        direction: form.direction,
        result: form.result,
        stopPoints: Number(form.stopPoints),
        rr: Number(form.rr),
        screenshotPath,
        note: form.note,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      };

      if (isEdit) {
        await updateTrade(trade);
        setMessage({ kind: "ok", text: "Trade updated" });
        onDone?.();
      } else {
        await addTrade(trade);
        setMessage({ kind: "ok", text: "Trade saved" });
        resetForm();
      }
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>{isEdit ? `Edit Trade — ${initial?.date}` : "Log a Trade"}</h2>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Screenshot{isEdit ? "" : " (required)"}</label>
        {storedShot.loading ? (
          <p className="small-note">Loading screenshot…</p>
        ) : (
          <ScreenshotDropzone
            previewUrl={screenshotDataUrl ?? storedShot.url}
            onFile={handleFile}
            onClear={clearScreenshot}
          />
        )}
        {storedShot.error && <span className="error-text">{storedShot.error}</span>}
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Date</label>
          <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
        </div>
        <div className="field">
          <label>Day</label>
          <input value={dayOfWeek(form.date)} disabled />
        </div>
        <div className="field">
          <label>Entry time</label>
          <input type="time" value={form.entryTime} onChange={(e) => set("entryTime", e.target.value)} required />
        </div>
        <div className="field">
          <label>Exit time</label>
          <input
            type="time"
            value={form.exitTime}
            onChange={(e) => set("exitTime", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>Direction</label>
          <select value={form.direction} onChange={(e) => set("direction", e.target.value as Direction)}>
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>
        </div>
        <div className="field">
          <label>Result</label>
          <select value={form.result} onChange={(e) => set("result", e.target.value as Result)}>
            <option value="W">Win</option>
            <option value="L">Loss</option>
            <option value="BE">Break-even</option>
          </select>
        </div>
        <div className="field">
          <label>Stop (pts.)</label>
          <input
            type="number"
            step="0.01"
            value={form.stopPoints}
            onChange={(e) => set("stopPoints", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>RR</label>
          <input
            type="number"
            step="0.01"
            value={form.rr}
            onChange={(e) => set("rr", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Note</label>
        <textarea value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Optional note" />
      </div>

      <div className="row">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save trade"}
        </button>
        {isEdit && (
          <button type="button" onClick={onDone} disabled={saving}>
            Cancel
          </button>
        )}
        {message && (
          <span className={message.kind === "ok" ? "success-text" : "error-text"}>{message.text}</span>
        )}
      </div>
    </form>
  );
}
