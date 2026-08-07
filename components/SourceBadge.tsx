/**
 * <SourceBadge> — MANUAL / METER / INVERTER_API (§4.4).
 * Manual is visually loud ON PURPOSE: a typed-in number must be unmistakable
 * everywhere it appears downstream.
 */
import { InfoTip } from "./InfoTip";

export type Source = "MANUAL" | "METER" | "INVERTER_API";

export function SourceBadge({ source }: { source: Source }) {
  if (source === "MANUAL") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-badge border-2 border-amber-700 bg-butter px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">
        ✎ Manual
        <InfoTip termKey="manual_reading" />
      </span>
    );
  }
  if (source === "METER") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-badge bg-mist px-3 py-0.5 text-xs font-semibold text-teal-600">
        Meter
        <InfoTip termKey="revenue_grade_meter" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-badge bg-surface-2 px-3 py-0.5 text-xs font-semibold text-ink-700">
      Inverter API
    </span>
  );
}
