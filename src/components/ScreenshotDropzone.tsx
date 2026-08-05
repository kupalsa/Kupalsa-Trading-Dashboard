import { useRef, type DragEvent } from "react";

interface Props {
  previewUrl: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  busy?: boolean;
}

export default function ScreenshotDropzone({ previewUrl, onFile, onClear, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) onFile(file);
  }

  if (previewUrl) {
    return (
      <div className="field">
        <img src={previewUrl} alt="Trade screenshot" className="screenshot-preview" />
        <div className="row">
          <button type="button" onClick={onClear}>
            Remove screenshot
          </button>
          {busy && <span className="muted">Extracting trade data…</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="screenshot-drop"
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onPaste={handlePaste}
      tabIndex={0}
    >
      Click, drag a file, or paste a screenshot here
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
