import { useState } from "react";
import {
  newLoggerQuestion,
  type BacktestSetup,
  type LoggerQuestion,
  type LoggerQuestionType,
} from "../lib/backtestSetup";

const TYPES: LoggerQuestionType[] = ["choice", "date", "time", "text", "number"];

/** Full edit of one setup's question list: add, reorder, retype, delete. */
export default function BacktestSetupEditor({
  setup,
  onSave,
  onCancel,
  saving,
}: {
  setup: BacktestSetup;
  onSave: (questions: LoggerQuestion[]) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [questions, setQuestions] = useState<LoggerQuestion[]>(setup.questions);

  function update(i: number, patch: Partial<LoggerQuestion>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function move(i: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function remove(i: number) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function add() {
    setQuestions((prev) => [...prev, newLoggerQuestion()]);
  }

  return (
    <div className="wizard-editor">
      {questions.length === 0 && (
        <p className="muted" style={{ marginTop: 0 }}>
          No questions yet — add the first one below.
        </p>
      )}
      {questions.map((q, i) => (
        <div className="wizard-editor-row" key={q.id}>
          <div className="wizard-editor-row-head">
            <span className="small-note">Q{i + 1}</span>
            <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                ↑
              </button>
              <button
                type="button"
                disabled={i === questions.length - 1}
                onClick={() => move(i, 1)}
                title="Move down"
              >
                ↓
              </button>
              <button type="button" className="danger" onClick={() => remove(i)} title="Delete">
                Delete
              </button>
            </div>
          </div>
          <div className="wizard-editor-grid">
            <input
              placeholder="Section (e.g. ZONES)"
              value={q.section}
              onChange={(e) => update(i, { section: e.target.value })}
            />
            <select
              value={q.type}
              onChange={(e) => update(i, { type: e.target.value as LoggerQuestionType })}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <input
            placeholder="Question title"
            value={q.title}
            onChange={(e) => update(i, { title: e.target.value })}
          />
          <input
            placeholder="Note (optional)"
            value={q.note}
            onChange={(e) => update(i, { note: e.target.value })}
          />
          {q.type === "choice" && (
            <input
              placeholder="Options, comma-separated (e.g. Yes, No)"
              value={q.options.join(", ")}
              onChange={(e) =>
                update(i, {
                  options: e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
            />
          )}
        </div>
      ))}

      <button type="button" onClick={add} style={{ marginTop: 4 }}>
        + Add question
      </button>

      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" className="primary" disabled={saving} onClick={() => onSave(questions)}>
          {saving ? "Saving…" : "Save questions"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
