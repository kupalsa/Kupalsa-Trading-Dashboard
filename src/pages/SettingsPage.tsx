import { useState } from "react";
import { useData } from "../lib/DataContext";
import { testConnection } from "../lib/githubStore";
import type { AppSettings } from "../lib/settings";

export default function SettingsPage() {
  const { settings, updateSettings, refresh } = useData();
  const [form, setForm] = useState<AppSettings>(settings);
  const [testStatus, setTestStatus] = useState<
    { kind: "idle" } | { kind: "testing" } | { kind: "ok"; msg: string } | { kind: "error"; msg: string }
  >({ kind: "idle" });
  const [saved, setSaved] = useState(false);

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => refresh(), 100);
  }

  async function handleTest() {
    setTestStatus({ kind: "testing" });
    try {
      const fullName = await testConnection(form);
      setTestStatus({ kind: "ok", msg: `Connected to ${fullName}` });
    } catch (e) {
      setTestStatus({ kind: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Settings</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        Stored only in this browser's local storage — never committed to your repo.
      </p>

      <div className="panel">
        <h2>GitHub (data storage)</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          Create a Personal Access Token at{" "}
          <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer">
            github.com/settings/tokens
          </a>{" "}
          (fine-grained, scoped to just this repo, with Contents: Read and write permission).
        </p>
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="field">
            <label>GitHub username / org</label>
            <input
              value={form.githubOwner}
              onChange={(e) => set("githubOwner", e.target.value)}
              placeholder="e.g. nikekourbatov"
            />
          </div>
          <div className="field">
            <label>Repository name</label>
            <input
              value={form.githubRepo}
              onChange={(e) => set("githubRepo", e.target.value)}
              placeholder="e.g. trading-dashboard"
            />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Personal Access Token</label>
          <input
            type="password"
            value={form.githubToken}
            onChange={(e) => set("githubToken", e.target.value)}
            placeholder="github_pat_..."
            style={{ minWidth: 320 }}
          />
        </div>
        <div className="row">
          <button onClick={handleTest} disabled={!form.githubOwner || !form.githubRepo || !form.githubToken}>
            Test connection
          </button>
          {testStatus.kind === "testing" && <span className="muted">Testing…</span>}
          {testStatus.kind === "ok" && <span className="success-text">{testStatus.msg}</span>}
          {testStatus.kind === "error" && <span className="error-text">{testStatus.msg}</span>}
        </div>
      </div>

      <div className="panel">
        <h2>Anthropic (screenshot extraction)</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          Optional. Without a key, you can still log trades manually. Get a key at{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
        </p>
        <div className="field">
          <label>Anthropic API key</label>
          <input
            type="password"
            value={form.anthropicKey}
            onChange={(e) => set("anthropicKey", e.target.value)}
            placeholder="sk-ant-..."
            style={{ minWidth: 320 }}
          />
        </div>
      </div>

      <div className="row">
        <button className="primary" onClick={handleSave}>
          Save settings
        </button>
        {saved && <span className="success-text">Saved</span>}
      </div>
    </div>
  );
}
