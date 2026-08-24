import { useEffect, useRef, useState } from "react";
import { useData } from "../lib/DataContext";
import { fetchRepoText, GithubApiError } from "../lib/githubStore";
import { backtestHelperPath } from "../lib/strategy";

/**
 * A user-uploaded, self-contained HTML tool (e.g. a trade-logging wizard),
 * rendered inline. The app never parses it — re-uploading just replaces the
 * file, so any future version of the tool works without a code change here.
 */
export default function BacktestHelperPanel({ strategyId }: { strategyId: string }) {
  const { settings, saveBacktestHelper } = useData();
  const path = backtestHelperPath(strategyId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setHtml(null);
    fetchRepoText(settings, path)
      .then((text) => {
        if (!cancelled) setHtml(text);
      })
      .catch((e) => {
        if (cancelled) return;
        // No file uploaded yet is the normal starting state, not an error.
        if (!(e instanceof GithubApiError && e.status === 404)) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings, path, reloadKey]);

  async function handleFile(file: File) {
    setUploadError(null);
    if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
      setUploadError("Please choose an .html file.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await saveBacktestHelper(path, dataUrl.split(",")[1] ?? "");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  const hasTool = Boolean(html);

  return (
    <div className="panel">
      <h2>Trade Logger Tool</h2>
      <p className="small-note" style={{ marginTop: 0 }}>
        Upload a self-contained HTML tool to help log opportunities. It runs right here — re-upload
        anytime a new version replaces the old one.
      </p>

      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : hasTool ? "Replace file" : "Upload .html file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".html,text/html"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {uploadError && <span className="error-text">{uploadError}</span>}
      </div>

      {loading && <p className="small-note">Loading…</p>}
      {loadError && <p className="error-text">{loadError}</p>}
      {!loading && !loadError && !hasTool && (
        <p className="muted">No tool uploaded yet for this strategy.</p>
      )}

      {hasTool && (
        <iframe
          srcDoc={html ?? undefined}
          className="helper-frame"
          sandbox="allow-scripts allow-forms"
          title="Backtest helper tool"
        />
      )}
    </div>
  );
}
