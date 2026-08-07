"use client";

/**
 * <StepFlow> — multi-step wizards for onboarding and issuance (§4.4).
 * Mobile-first (site creation happens on a phone at the installation):
 * works at 360px, touch targets ≥ 44px.
 */
import { useState, type ReactNode } from "react";

export interface Step {
  key: string;
  title: string;
  content: ReactNode;
  /** Return an error message to block advancing, or null to allow. */
  validate?: () => string | null;
}

export function StepFlow({
  steps,
  onComplete,
  labels = { back: "Back", next: "Next", finish: "Finish" },
}: {
  steps: Step[];
  onComplete: () => void;
  labels?: { back: string; next: string; finish: string };
}) {
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const step = steps[index]!;
  const last = index === steps.length - 1;

  function advance() {
    const problem = step.validate?.() ?? null;
    setError(problem);
    if (problem) return;
    if (last) onComplete();
    else setIndex(index + 1);
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <ol className="mb-6 flex items-center gap-1" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
            <span
              aria-current={i === index ? "step" : undefined}
              className={`h-2 w-full rounded-badge ${
                i < index ? "bg-mint-700" : i === index ? "bg-teal-600" : "bg-ink-200"
              }`}
            />
            <span
              className={`text-[11px] ${i === index ? "font-semibold text-ink-900" : "text-ink-500"}`}
            >
              {s.title}
            </span>
          </li>
        ))}
      </ol>

      <div className="rounded-card bg-surface-1 p-4 shadow-soft">{step.content}</div>

      {error && (
        <p role="alert" className="mt-3 rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-between gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => {
            setError(null);
            setIndex(Math.max(0, index - 1));
          }}
          className="min-h-11 rounded-input border border-ink-200 px-5 text-sm font-medium text-ink-700 disabled:opacity-40"
        >
          {labels.back}
        </button>
        <button
          type="button"
          onClick={advance}
          className="min-h-11 rounded-input bg-teal-600 px-6 text-sm font-semibold text-white hover:opacity-90"
        >
          {last ? labels.finish : labels.next}
        </button>
      </div>
    </div>
  );
}
