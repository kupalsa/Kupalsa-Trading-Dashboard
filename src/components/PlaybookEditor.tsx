import { useState } from "react";
import { useData } from "../lib/DataContext";
import { compressImage, dataUrlToBase64 } from "../lib/image";
import { screenshotUrl } from "../lib/githubStore";
import { newPlaybookStep, playbookImagePath, type PlaybookStep } from "../lib/strategy";
import ScreenshotDropzone from "./ScreenshotDropzone";

interface Props {
  strategyId: string;
  steps: PlaybookStep[];
  onChange: (steps: PlaybookStep[]) => void;
}

export default function PlaybookEditor({ strategyId, steps, onChange }: Props) {
  const { savePlaybookImage, settings } = useData();
  // Images live in the repo, but a freshly pasted one is shown from memory
  // until the strategy is saved.
  const [pending, setPending] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  function update(id: string, patch: Partial<PlaybookStep>) {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  async function handleImage(step: PlaybookStep, file: File) {
    setBusy(step.id);
    try {
      // Playbook screenshots are reference material worth keeping legible.
      const dataUrl = await compressImage(file, 2000, 0.85);
      setPending((p) => ({ ...p, [step.id]: dataUrl }));
      const path = playbookImagePath(strategyId, step.id);
      await savePlaybookImage(path, dataUrlToBase64(dataUrl));
      update(step.id, { imagePath: path });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="small-note" style={{ marginTop: 0 }}>
        Walk through the strategy one step at a time — a heading, a chart, and what to look for.
        Written once, then it stays as the reference.
      </p>

      {steps.length === 0 && <p className="muted">No steps yet.</p>}

      {steps.map((step, i) => {
        const preview = pending[step.id] ?? (step.imagePath ? screenshotUrl(settings, step.imagePath) : null);
        return (
          <div className="playbook-step" key={step.id}>
            <div className="playbook-step-head">
              <span className="playbook-num">{i + 1}</span>
              <input
                value={step.heading}
                onChange={(e) => update(step.id, { heading: e.target.value })}
                placeholder="Step heading"
                className="playbook-heading"
              />
              <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                  ↑
                </button>
                <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} title="Move down">
                  ↓
                </button>
                <button
                  onClick={() => onChange(steps.filter((s) => s.id !== step.id))}
                  title="Delete step"
                >
                  ✕
                </button>
              </div>
            </div>

            {preview ? (
              <div className="playbook-image-wrap">
                <img src={preview} alt={step.heading || `Step ${i + 1}`} className="playbook-image" />
                <button
                  className="playbook-replace"
                  onClick={() => {
                    setPending((p) => {
                      const { [step.id]: _drop, ...rest } = p;
                      return rest;
                    });
                    update(step.id, { imagePath: null });
                  }}
                >
                  Replace image
                </button>
              </div>
            ) : (
              <ScreenshotDropzone
                previewUrl={null}
                onFile={(f) => handleImage(step, f)}
                onClear={() => {}}
                busy={busy === step.id}
              />
            )}

            <textarea
              value={step.description}
              onChange={(e) => update(step.id, { description: e.target.value })}
              placeholder="What happens at this step, and what you are looking for…"
              style={{ marginTop: 10, minHeight: 90 }}
            />
          </div>
        );
      })}

      <button onClick={() => onChange([...steps, newPlaybookStep()])}>+ Add step</button>
    </div>
  );
}
