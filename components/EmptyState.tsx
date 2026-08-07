/**
 * <EmptyState> — explains what goes here and offers the action (§4.4).
 * Never a bare "No data".
 */
import type { ReactNode } from "react";

export function EmptyState({
  title,
  explanation,
  action,
}: {
  title: string;
  explanation: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-ink-200 bg-surface-1 px-6 py-12 text-center">
      <p className="text-base font-semibold text-ink-900">{title}</p>
      <p className="max-w-md text-sm text-ink-700">{explanation}</p>
      {action}
    </div>
  );
}
