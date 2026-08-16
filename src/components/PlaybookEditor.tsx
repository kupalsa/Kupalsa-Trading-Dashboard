import { useState } from "react";
import { useData } from "../lib/DataContext";
import { compressImage, dataUrlToBase64 } from "../lib/image";
import { newPlaybookStep, playbookImagePath, type PlaybookStep } from "../lib/strategy";
import ScreenshotDropzone from "./ScreenshotDropzone";
import ConfirmDialog from "./ConfirmDialog";
import { useRepoImage } from "./RepoImage";

interface Props {
  strategyId: string;
  steps: PlaybookStep[];
  onChange: (steps: PlaybookStep[]) => void;
}

interface StepProps {
  step: PlaybookStep;
  index: number;
  total: number;
  /** Shown instead of the stored image until the strategy is saved. */
  pendingUrl: string | null;
  busy: boolean;
  onUpdate: (patch: Partial<PlaybookStep>) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
  onFile: (file: File) => void;
  onClearImage: () => void;
}

function PlaybookStepRow({
  step,
  index,
  total,
  pendingUrl,
  busy,
  onUpdate,
  onMove,
  onDelete,
  onFile,
  onClearImage,
}: StepProps) {
  const stored = useRepoImage(pendingUrl ? null : step.imagePath);
  const preview = pendingUrl ?? stored.url;

  return (
    <div className="playbook-step">
      <div className="playbook-step-head">
        <span className="playbook-num">{index + 1}</span>
        <input
          value={step.heading}
          onChange={(e) => onUpdate({ heading: e.target.value })}
          placeholder="Step heading"
          className="playbook-heading"
        />
        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
          <button onClick={() => onMove(-1)} disabled={index === 0} title="Move up">
            ↑
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} title="Move down">
            ↓
          </button>
          <button className="danger" onClick={onDelete} title="Delete step">
            ✕
          </button>
        </div>
      </div>

      {stored.loading && <p className="small-note">Loading image…</p>}

      {preview ? (
        <div className="playbook-image-wrap">
          <img src={preview} alt={step.heading || `Step ${index + 1}`} className="playbook-image" />
          <button className="playbook-replace" onClick={onClearImage}>
            Replace image
          </button>
        </div>
      ) : (
        !stored.loading && (
          <ScreenshotDropzone previewUrl={null} onFile={onFile} onClear={() => {}} busy={busy} />
        )
      )}

      <textarea
        value={step.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder="What happens at this step, and what you are looking for…"
        style={{ marginTop: 10, minHeight: 90 }}
      />
    </div>
  );
}

export default function PlaybookEditor({ strategyId, steps, onChange }: Props) {
  const { savePlaybookImage } = useData();
  const [pending, setPending] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  function clearImage(step: PlaybookStep) {
    setPending((p) => {
      const next = { ...p };
      delete next[step.id];
      return next;
    });
    update(step.id, { imagePath: null });
  }

  return (
    <div>
      <p className="small-note" style={{ marginTop: 0 }}>
        Walk through the strategy one step at a time — a heading, a chart, and what to look for.
        Written once, then it stays as the reference.
      </p>

      {steps.length === 0 && <p className="muted">No steps yet.</p>}

      {steps.map((step, i) => (
        <PlaybookStepRow
          key={step.id}
          step={step}
          index={i}
          total={steps.length}
          pendingUrl={pending[step.id] ?? null}
          busy={busy === step.id}
          onUpdate={(patch) => update(step.id, patch)}
          onMove={(d) => move(i, d)}
          onDelete={() => setConfirmDeleteId(step.id)}
          onFile={(f) => handleImage(step, f)}
          onClearImage={() => clearImage(step)}
        />
      ))}

      <button onClick={() => onChange([...steps, newPlaybookStep()])}>+ Add step</button>

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete this step?"
          message="The step and its image will be removed once you save the strategy."
          onConfirm={() => {
            onChange(steps.filter((s) => s.id !== confirmDeleteId));
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
