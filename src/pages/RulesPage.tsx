import { useEffect, useState } from "react";
import { useData } from "../lib/DataContext";

export default function RulesPage() {
  const { rules, saveRules, githubReady, loading } = useData();
  const [strategyRules, setStrategyRules] = useState(rules.strategyRules);
  const [strategyNotes, setStrategyNotes] = useState(rules.strategyNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStrategyRules(rules.strategyRules);
    setStrategyNotes(rules.strategyNotes);
  }, [rules]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveRules({ strategyRules, strategyNotes });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!githubReady) {
    return <div className="panel">Connect GitHub in Settings to edit rules &amp; notes.</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Rules &amp; Notes</h1>
      {loading && <p className="muted">Loading…</p>}

      <div className="panel">
        <h2>Strategy Rules</h2>
        <textarea
          style={{ minHeight: 220 }}
          value={strategyRules}
          onChange={(e) => {
            setStrategyRules(e.target.value);
            setSaved(false);
          }}
          placeholder="Trigger, validation, stop/TP rules, priorities…"
        />
      </div>

      <div className="panel">
        <h2>Strategy Notes</h2>
        <textarea
          style={{ minHeight: 220 }}
          value={strategyNotes}
          onChange={(e) => {
            setStrategyNotes(e.target.value);
            setSaved(false);
          }}
          placeholder="Freeform notes about the strategy…"
        />
      </div>

      <div className="row">
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="success-text">Saved</span>}
      </div>
    </div>
  );
}
