import { useState } from "react";
import { useData } from "../lib/DataContext";
import { compressImage } from "../lib/image";
import {
  derive,
  emptyOpportunity,
  SETUP_HELP,
  SETUP_TYPES,
  STOOD_DOWN_TYPES,
  type Arrival,
  type Direction,
  type Opportunity,
  type Outcome,
  type Phase,
  type SetupType,
  type StoodDownType,
  type YesNoNA,
  type ZoneSide,
  type ZoneType,
} from "../lib/backtest";
import { BoolField, DerivedField, FieldGroup, NumField, SelectField, TextField } from "./fields";

const SIDES = ["Upper", "Lower"] as const;
const ZONE_TYPES = ["Wick", "Body"] as const;
const OUTCOMES = ["Win", "Loss", "Breakeven", "NA"] as const;
const ARRIVALS = ["Impulsive", "Mixed", "Drift"] as const;
const PHASES = ["A", "B", "C", "D", "E"] as const;
const YES_NO_NA = ["Yes", "No", "NA"] as const;
const DIRECTIONS = ["Long", "Short"] as const;

interface Props {
  initial: Opportunity;
  nextSeq: number;
  onDone: () => void;
}

export default function OpportunityForm({ initial, onDone }: Props) {
  const { saveOpportunity, saveBacktestScreenshot } = useData();
  const [o, setO] = useState<Opportunity>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const d = derive(o);
  const isStandDown = o.stoodDownType !== "None";

  function set<K extends keyof Opportunity>(key: K, value: Opportunity[K]) {
    setO((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const added: { path: string; caption: string }[] = [];
      for (const file of Array.from(files)) {
        const dataUrl = await compressImage(file);
        const path = `backtest-screenshots/${o.id}/${crypto.randomUUID()}.jpg`;
        await saveBacktestScreenshot(path, dataUrl.split(",")[1] ?? "");
        added.push({ path, caption: file.name.replace(/\.[^.]+$/, "") });
      }
      setO((prev) => ({ ...prev, screenshots: [...prev.screenshots, ...added] }));
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!o.date) {
      setMessage({ kind: "error", text: "Date is required — use the actual trade/replay date." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveOpportunity(o);
      setMessage({ kind: "ok", text: `Opportunity #${o.seq} saved` });
      onDone();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>Opportunity #{o.seq}</h2>
      <p className="muted" style={{ marginTop: -6, fontSize: 12 }}>
        A row is an opportunity that met all 16 rules — including limit orders that never
        filled. Outcomes are self-reported, never inferred from the chart.
      </p>

      <FieldGroup title="Identification">
        <TextField label="Date" type="date" value={o.date} onChange={(v) => set("date", v)} />
        <DerivedField label="Day" value={d.day} />
        <SelectField
          label="Stood Down Type"
          value={o.stoodDownType}
          options={STOOD_DOWN_TYPES}
          allowEmpty={false}
          width={210}
          onChange={(v) => set("stoodDownType", (v || "None") as StoodDownType)}
        />
      </FieldGroup>

      {isStandDown && (
        <p className="notice">
          Stood down — this row counts as an available opportunity that was passed on, and is
          excluded from win-rate and expectancy figures.
        </p>
      )}

      <FieldGroup title="Entry Zone (traded from)">
        <SelectField label="EZ Side" value={o.ezSide} options={SIDES} onChange={(v) => set("ezSide", v as ZoneSide | "")} />
        <SelectField label="EZ Type" value={o.ezType} options={ZONE_TYPES} onChange={(v) => set("ezType", v as ZoneType | "")} />
        <BoolField label="Tagged pre-session" value={o.ezTaggedPreSession} onChange={(v) => set("ezTaggedPreSession", v)} />
        <BoolField label="Tagged during session" value={o.ezTaggedDuringSession} onChange={(v) => set("ezTaggedDuringSession", v)} />
      </FieldGroup>

      <FieldGroup title="Target Zone (aimed at)">
        <SelectField label="TZ Side" value={o.tzSide} options={SIDES} onChange={(v) => set("tzSide", v as ZoneSide | "")} />
        <SelectField label="TZ Type" value={o.tzType} options={ZONE_TYPES} onChange={(v) => set("tzType", v as ZoneType | "")} />
        <BoolField label="Tagged pre-session" value={o.tzTaggedPreSession} onChange={(v) => set("tzTaggedPreSession", v)} />
        <BoolField label="Tagged during session" value={o.tzTaggedDuringSession} onChange={(v) => set("tzTaggedDuringSession", v)} />
        <BoolField label="Broken by end (23:05)" value={o.tzBrokenByEnd} onChange={(v) => set("tzBrokenByEnd", v)} />
      </FieldGroup>

      <FieldGroup title="Context & timing">
        <BoolField label="2nd upper zone exists" value={o.secondUpperZone} onChange={(v) => set("secondUpperZone", v)} />
        <BoolField label="2nd lower zone exists" value={o.secondLowerZone} onChange={(v) => set("secondLowerZone", v)} />
        <TextField label="Entry time (IL)" type="time" value={o.entryTime} onChange={(v) => set("entryTime", v)} />
        <TextField label="Exit time (IL)" type="time" value={o.exitTime} onChange={(v) => set("exitTime", v)} />
        <DerivedField label="Window traded" value={d.windowTraded} width={130} />
        <DerivedField label="Mins in trade" value={d.minsInTrade} />
        <SelectField
          label="17:00 close changed zones"
          value={o.closeChangedZones}
          options={YES_NO_NA}
          width={130}
          onChange={(v) => set("closeChangedZones", v as YesNoNA | "")}
        />
      </FieldGroup>

      <FieldGroup title="Setup">
        <SelectField
          label="Setup Type"
          value={o.setupType}
          options={SETUP_TYPES}
          width={190}
          onChange={(v) => set("setupType", v as SetupType | "")}
        />
        <SelectField label="Direction" value={o.direction} options={DIRECTIONS} width={110} onChange={(v) => set("direction", v as Direction | "")} />
        <SelectField label="Arrival" value={o.arrival} options={ARRIVALS} width={130} onChange={(v) => set("arrival", v as Arrival | "")} />
        <BoolField label="FVG present at entry" value={o.fvgPresentAtEntry} onChange={(v) => set("fvgPresentAtEntry", v)} />
        <SelectField label="FVG filled" value={o.fvgFilled} options={YES_NO_NA} width={110} onChange={(v) => set("fvgFilled", v as YesNoNA | "")} />
        <SelectField label="Phase HTF" value={o.phaseHTF} options={PHASES} width={90} onChange={(v) => set("phaseHTF", v as Phase | "")} />
        <SelectField label="Phase LTF" value={o.phaseLTF} options={PHASES} width={90} onChange={(v) => set("phaseLTF", v as Phase | "")} />
      </FieldGroup>

      {o.setupType && <div className="setup-help">{SETUP_HELP[o.setupType as SetupType]}</div>}

      {o.fvgPresentAtEntry && o.fvgFilled === "NA" && (
        <p className="notice warn">
          An FVG was present, so "FVG filled" should be Yes or No — NA means no FVG existed.
        </p>
      )}

      <div className="field-group">
        <h3>
          Price levels
          <button
            type="button"
            className="lock-btn"
            onClick={() => set("pricesLocked", !o.pricesLocked)}
          >
            {o.pricesLocked ? "🔒 Locked — click to edit" : "🔓 Lock prices"}
          </button>
        </h3>
        <div className="row">
          <NumField label="Nat Entry" value={o.natEntry} disabled={o.pricesLocked} onChange={(v) => set("natEntry", v)} />
          <NumField label="Nat Stop" value={o.natStop} disabled={o.pricesLocked} onChange={(v) => set("natStop", v)} />
          <NumField label="Nat TP" value={o.natTP} disabled={o.pricesLocked} onChange={(v) => set("natTP", v)} />
          <DerivedField label="Nat Stop Size" value={d.natStopSize} />
        </div>
        <div className="row">
          <NumField label="Opt Entry" value={o.optEntry} disabled={o.pricesLocked} onChange={(v) => set("optEntry", v)} />
          <NumField label="Opt Stop" value={o.optStop} disabled={o.pricesLocked} onChange={(v) => set("optStop", v)} />
          <NumField label="Opt TP" value={o.optTP} disabled={o.pricesLocked} onChange={(v) => set("optTP", v)} />
          <DerivedField label="Opt Stop Size" value={d.optStopSize} />
          <DerivedField
            label="Optimization needed"
            value={d.optimizationNeeded == null ? null : d.optimizationNeeded ? "Yes" : "No"}
            width={130}
          />
        </div>
        <div className="row">
          <NumField label="Session Peak" value={o.sessionPeak} disabled={o.pricesLocked} onChange={(v) => set("sessionPeak", v)} width={130} />
          <NumField label="Session Trough" value={o.sessionTrough} disabled={o.pricesLocked} onChange={(v) => set("sessionTrough", v)} width={130} />
        </div>
      </div>

      <FieldGroup title="Natural intraday (counterfactual)">
        <BoolField label="Nat filled" value={o.natFilled} onChange={(v) => set("natFilled", v)} />
        <SelectField label="Nat Outcome" value={o.natOutcome} options={OUTCOMES} width={130} onChange={(v) => set("natOutcome", v as Outcome | "")} />
        <DerivedField label="Natural R" value={d.naturalR} />
        <DerivedField label="Nat MFE R" value={d.natMfeR} />
        <DerivedField label="Nat MAE R" value={d.natMaeR} />
      </FieldGroup>

      <FieldGroup title="Optimized intraday (actual)">
        <BoolField label="Opt filled" value={o.optFilled} onChange={(v) => set("optFilled", v)} />
        <SelectField label="Opt Outcome" value={o.optOutcome} options={OUTCOMES} width={130} onChange={(v) => set("optOutcome", v as Outcome | "")} />
        <DerivedField label="Optimized R" value={d.optimizedR} />
        <DerivedField label="Opt MFE R" value={d.optMfeR} />
        <DerivedField label="Opt MAE R" value={d.optMaeR} />
      </FieldGroup>

      <div className="field-group">
        <h3>Swing (entry → next day 23:05)</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          If neither Swing TP nor Swing Stop is hit by next-day 23:05, close at market and enter
          that close price as Swing TP — it always represents the effective exit.
        </p>
        <div className="row">
          <NumField label="Swing TP" value={o.swingTP} disabled={o.pricesLocked} onChange={(v) => set("swingTP", v)} />
          <NumField label="Swing Stop" value={o.swingStop} disabled={o.pricesLocked} onChange={(v) => set("swingStop", v)} />
          <DerivedField label="Swing Stop Size" value={d.swingStopSize} width={130} />
          <DerivedField label="Swing Valid" value={d.swingValid} width={110} />
        </div>
        <div className="row">
          <SelectField label="Swing Nat Outcome" value={o.swingNatOutcome} options={OUTCOMES} width={150} onChange={(v) => set("swingNatOutcome", v as Outcome | "")} />
          <DerivedField label="Swing Nat R" value={d.swingNatR} />
          <SelectField label="Swing Opt Outcome" value={o.swingOptOutcome} options={OUTCOMES} width={150} onChange={(v) => set("swingOptOutcome", v as Outcome | "")} />
          <DerivedField label="Swing Opt R" value={d.swingOptR} />
        </div>
      </div>

      <div className="field-group">
        <h3>Screenshots</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Reference material for manual review — 15m pre-entry, 1m entry detail, 15m post-close,
          optionally 4H/daily context. Not used for automated extraction.
        </p>
        <input type="file" accept="image/*" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        {uploading && <span className="muted"> Uploading…</span>}
        {o.screenshots.length > 0 && (
          <ul className="shot-list">
            {o.screenshots.map((s) => (
              <li key={s.path}>
                <span>{s.caption || s.path.split("/").pop()}</span>
                <button
                  type="button"
                  onClick={() =>
                    setO((prev) => ({
                      ...prev,
                      screenshots: prev.screenshots.filter((x) => x.path !== s.path),
                    }))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Note</label>
        <textarea value={o.note} onChange={(e) => set("note", e.target.value)} placeholder="Optional note" />
      </div>

      <div className="row">
        <button type="submit" className="primary" disabled={saving || uploading}>
          {saving ? "Saving…" : "Save opportunity"}
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        {message && (
          <span className={message.kind === "ok" ? "success-text" : "error-text"}>{message.text}</span>
        )}
      </div>
    </form>
  );
}

export { emptyOpportunity };
