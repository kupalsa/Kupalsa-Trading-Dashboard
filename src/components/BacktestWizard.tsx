import { useEffect, useRef, useState } from "react";
import type { BacktestSetup } from "../lib/backtestSetup";

/**
 * The in-app equivalent of the old uploaded HTML "Trade Logger" tool: step
 * through a setup's questions one at a time, then produce a numbered summary
 * to copy and paste into chat alongside the trade's closing screenshot.
 */
export default function BacktestWizard({ setup }: { setup: BacktestSetup }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(() =>
    new Array(setup.questions.length).fill(null),
  );
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const total = setup.questions.length;

  // Switching setups (or a questions edit) restarts the run rather than
  // showing stale answers against a different question list.
  useEffect(() => {
    setIdx(0);
    setAnswers(new Array(setup.questions.length).fill(null));
    setCopyStatus(null);
  }, [setup.id, setup.questions.length]);

  useEffect(() => {
    setCopyStatus(null);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [idx]);

  if (total === 0) {
    return <p className="muted">This setup has no questions yet — edit it to add some.</p>;
  }

  function restart() {
    setIdx(0);
    setAnswers(new Array(total).fill(null));
    setCopyStatus(null);
  }

  function answer(i: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function goNext() {
    setIdx((i) => i + 1);
  }

  function summaryText(): string {
    return setup.questions.map((_, i) => `${i + 1}. ${answers[i] ?? "skip"}`).join("\n");
  }

  async function copySummary() {
    const text = summaryText();
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("✓ Copied — now paste it into the chat.");
    } catch {
      setCopyStatus("Couldn't auto-copy — select the text above and copy it manually.");
    }
  }

  if (idx >= total) {
    return (
      <div className="wizard-card">
        <div className="wizard-progress">
          <div className="wizard-progress-bar" style={{ width: "100%" }} />
        </div>
        <div className="wizard-progress-label">Done — review and copy</div>
        <div className="wizard-section-tag">SUMMARY</div>
        <div className="wizard-title">Ready to paste into chat</div>
        <p className="wizard-note">
          Select all and copy, or use the button below. Then paste into the chat along with the
          trade's closing screenshot.
        </p>
        <textarea className="wizard-summary-box" readOnly value={summaryText()} />
        {copyStatus && <div className="wizard-copy-status">{copyStatus}</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="primary" onClick={copySummary}>
            📋 Copy summary
          </button>
          <button type="button" onClick={restart}>
            ↺ New trade
          </button>
        </div>
      </div>
    );
  }

  const q = setup.questions[idx];
  const progressPct = (idx / total) * 100;

  return (
    <div className="wizard-card">
      <div className="wizard-progress">
        <div className="wizard-progress-bar" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="wizard-progress-label">
        Question {idx + 1} of {total}
      </div>
      {q.section && <div className="wizard-section-tag">{q.section}</div>}
      <div className="wizard-title">{q.title || "(untitled question)"}</div>
      {q.note && <p className="wizard-note">{q.note}</p>}

      {q.type === "choice" ? (
        <div className="wizard-options">
          {q.options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`wizard-opt${answers[idx] === opt ? " selected" : ""}`}
              onClick={() => {
                answer(idx, opt);
                setTimeout(goNext, 140);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <FreeInput
          key={q.id}
          type={q.type}
          value={answers[idx] ?? ""}
          onChange={(v) => answer(idx, v)}
          onSubmit={goNext}
          inputRef={inputRef}
        />
      )}

      <div className="row wizard-nav">
        <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          Back
        </button>
        <button
          type="button"
          className="wizard-skip"
          onClick={() => {
            if (answers[idx] === null) answer(idx, "skip");
            goNext();
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function FreeInput({
  type,
  value,
  onChange,
  onSubmit,
  inputRef,
}: {
  type: "date" | "time" | "text" | "number";
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="wizard-free">
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value) onSubmit();
        }}
      />
      <button type="button" className="primary" disabled={!value} onClick={onSubmit}>
        Next
      </button>
    </div>
  );
}
