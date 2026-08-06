import type { ReactNode } from "react";

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="field-group">
      <h3>{title}</h3>
      <div className="row">{children}</div>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  width = 130,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  width?: number;
  step?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ width }}
      />
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
  disabled,
  width = 110,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  width?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        step="0.1"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        style={{ width }}
      />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  allowEmpty = true,
  width = 160,
}: {
  label: string;
  value: T | "";
  options: readonly T[];
  onChange: (v: T | "") => void;
  allowEmpty?: boolean;
  width?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | "")}
        style={{ width }}
      >
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function BoolField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="bool-field">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** A computed value. Never editable — spec §6 forbids manual edits to derived fields. */
export function DerivedField({
  label,
  value,
  width = 110,
}: {
  label: string;
  value: string | number | null;
  width?: number;
}) {
  const display =
    value === null || value === "" || (typeof value === "number" && Number.isNaN(value))
      ? "—"
      : typeof value === "number"
        ? Number.isInteger(value)
          ? String(value)
          : value.toFixed(2)
        : value;
  return (
    <div className="field">
      <label>{label}</label>
      <div className="derived-value" style={{ width }}>
        {display}
      </div>
    </div>
  );
}
