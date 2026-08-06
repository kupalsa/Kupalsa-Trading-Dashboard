import { useCallback, useEffect, useState } from "react";
import { useData } from "../lib/DataContext";
import { compressImage } from "../lib/image";
import { extractTradeFromScreenshot } from "../lib/extract";
import { dayOfWeek } from "../lib/stats";
import { isAnthropicConfigured } from "../lib/settings";
import type { Direction, Result, Trade } from "../lib/types";
import ScreenshotDropzone from "./ScreenshotDropzone";

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

export default function TradeForm() {
  const { settings, addTrade, saveScreenshot } = useData();
  const [form, setForm] = useState(emptyForm);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const handleFile = useCallback(async (file: File) => {
    setMessage(null);
    const compressed = await compressImage(file);
    setScreenshotDataUrl(compressed);

    if (isAnthropicConfigured(settings)) {
      setExtracting(true);
      try {
        const extracted = await extractTradeFromScreenshot(settings, compressed);
        setForm((f) => ({
          ...f,
          date: extracted.date ?? f.date,
          entryTime: extracted.entryTime ?? f.entryTime,
          exitTime: extracted.exitTime ?? f.exitTime,
          direction: extracted.direction ?? f.direction,
          result: extracted.result ?? f.result,
          stopPoints: extracted.stopPoints != null ? String(extracted.stopPoints) : f.stopPoints,
        }));
      } catch (e) {
        setMessage({ kind: "error", text: `AI extraction failed: ${e instanceof Error ? e.message : e}` });
      } finally {
        setExtracting(false);
      }
    }
  }, [settings]);

  // Allow pasting a screenshot anywhere on the page, not just inside the dropzone.
  useEffect(() => {
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
  }, [handleFile]);

  function resetForm() {
    setForm({ ...emptyForm, date: todayStr() });
    setScreenshotDataUrl(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!screenshotDataUrl) {
      setMessage({ kind: "error", text: "A screenshot is required before saving a trade." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const id = crypto.randomUUID();
      const screenshotPath = `screenshots/${id}.jpg`;

      const trade: Trade = {
        id,
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
        createdAt: new Date().toISOString(),
      };

      await addTrade(trade);
      await saveScreenshot(screenshotPath, screenshotDataUrl.split(",")[1] ?? "");

      setMessage({ kind: "ok", text: "Trade saved" });
      resetForm();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>Log a Trade</h2>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Screenshot (required)</label>
        <ScreenshotDropzone
          previewUrl={screenshotDataUrl}
          onFile={handleFile}
          onClear={() => setScreenshotDataUrl(null)}
          busy={extracting}
        />
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
        <button type="submit" className="primary" disabled={saving || extracting}>
          {saving ? "Saving…" : "Save trade"}
        </button>
        {message && (
          <span className={message.kind === "ok" ? "success-text" : "error-text"}>{message.text}</span>
        )}
      </div>
    </form>
  );
}
