import { isAdherent, type DailyReview, type Trade } from "./types";
import type { Strategy } from "./strategy";

/**
 * RFC 4180 quoting: wrap in double quotes and double any inner quote. A value
 * starting with =, +, - or @ is prefixed with a quote so spreadsheets treat it
 * as text rather than a formula.
 */
function cell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function tradesToCsv(trades: Trade[], strategies: Strategy[]): string {
  const name = (id: string) => strategies.find((s) => s.id === id)?.name ?? id;
  const sorted = [...trades].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  return toCsv(
    ["Date", "Day", "Strategy", "Entry", "Exit", "Direction", "Result", "Stop (pts)", "R", "Note"],
    sorted.map((t) => [
      t.date,
      t.day,
      name(t.strategyId),
      t.entryTime,
      t.exitTime,
      t.direction,
      t.result,
      t.stopPoints,
      t.rr,
      t.note,
    ]),
  );
}

export function reviewsToCsv(reviews: DailyReview[], strategies: Strategy[]): string {
  const name = (id: string) => strategies.find((s) => s.id === id)?.name ?? id;
  const sorted = [...reviews].sort((a, b) => a.date.localeCompare(b.date));
  return toCsv(
    [
      "Date",
      "Strategy",
      "Session outcome",
      "States",
      "Adherent",
      "Backtest valid",
      "Execution focus",
      "No interference",
      "Session logged",
      "Stop/Entry/TP followed",
      "Strategy valid",
      "Structure valid",
      "Notes",
    ],
    sorted.map((r) => [
      r.date,
      name(r.strategyId),
      r.sessionOutcome,
      r.states.join("; "),
      isAdherent(r) ? "Yes" : "No",
      r.checklist.backtestValid ? "Yes" : "No",
      r.checklist.executionOnlyFocus ? "Yes" : "No",
      r.checklist.noInterference ? "Yes" : "No",
      r.checklist.sessionLogged ? "Yes" : "No",
      r.checklist.stopEntryTpFollowed ? "Yes" : "No",
      r.checklist.strategyValid ? "Yes" : "No",
      r.checklist.structureValid ? "Yes" : "No",
      r.notes,
    ]),
  );
}

/** Hand a generated file to the browser as a download. */
export function downloadText(filename: string, text: string, mime = "text/csv"): void {
  // The BOM makes Excel read UTF-8 correctly rather than mangling accents.
  const blob = new Blob(["﻿" + text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has already started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function stampedName(base: string, ext: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.${ext}`;
}
