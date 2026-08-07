"use client";

/**
 * <InfoTip> — the ELI5 system (§5). A first-class subsystem, not a tooltip
 * library.
 *
 * Hover / focus → small tooltip showing `short` (fast, non-committal).
 * Click → side panel with `term`, `eli5`, `why_it_matters`, `example`, a link
 * to the full glossary, and cross-links to related terms.
 *
 * Missing key: warning-state icon in development, hidden in production —
 * never a raw key on screen.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useGlossary } from "./GlossaryProvider";

export function InfoTip({ termKey }: { termKey: string }) {
  const glossary = useGlossary();
  const entry = glossary.get(termKey);
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const [panelTermKey, setPanelTermKey] = useState(termKey);
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // missing key handling (S0-4)
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <span
          title={`Missing glossary key: ${termKey}`}
          className="inline-flex h-4 w-4 items-center justify-center rounded-badge bg-butter text-[10px] font-bold text-amber-700 align-middle"
        >
          !
        </span>
      );
    }
    return null;
  }

  const panelEntry = glossary.get(panelTermKey) ?? entry;

  return (
    <span className="relative inline-block align-middle">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${entry.term} — explanation`}
        aria-describedby={hover ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={() => {
          setPanelTermKey(termKey);
          setOpen(true);
        }}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-badge bg-mist text-[10px] font-bold text-teal-600 hover:bg-teal-600 hover:text-white"
      >
        i
      </button>

      {hover && !open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-40 mt-1 w-56 -translate-x-1/2 rounded-input border border-ink-200 bg-surface-1 p-2 text-xs text-ink-700 shadow-soft"
        >
          {entry.short}
        </span>
      )}

      {open && (
        <SidePanel
          entry={panelEntry}
          onNavigate={(k) => setPanelTermKey(k)}
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
        />
      )}
    </span>
  );
}

function SidePanel({
  entry,
  onNavigate,
  onClose,
}: {
  entry: NonNullable<ReturnType<Map<string, import("./GlossaryProvider").GlossaryEntry>["get"]>>;
  onNavigate: (key: string) => void;
  onClose: () => void;
}) {
  const glossary = useGlossary();
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  // Dismissible, keyboard accessible, closes on Escape, does not trap focus
  // and does not block the underlying form (no modal overlay).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const related = (entry.relatedKeys ?? []).filter((k) => glossary.has(k));

  return (
    <div
      ref={panelRef}
      role="complementary"
      aria-labelledby={headingId}
      tabIndex={-1}
      className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-ink-200 bg-surface-1 p-6 shadow-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold text-ink-900">
          {entry.term}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-input px-2 py-1 text-ink-500 hover:bg-surface-2"
        >
          ✕
        </button>
      </div>

      <p className="text-[15px] leading-relaxed text-ink-900">{entry.eli5}</p>

      <div className="rounded-card bg-mist p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
          Why it matters here
        </p>
        <p className="mt-1 text-sm text-ink-900">{entry.whyItMatters}</p>
      </div>

      {entry.example && (
        <div className="rounded-card bg-surface-2 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Example
          </p>
          <p className="mt-1 text-sm text-ink-900">{entry.example}</p>
        </div>
      )}

      {related.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Related terms
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {related.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onNavigate(k)}
                className="rounded-badge bg-mist px-3 py-1 text-sm text-teal-600 hover:bg-teal-600 hover:text-white"
              >
                {glossary.get(k)!.term}
              </button>
            ))}
          </div>
        </div>
      )}

      <a href="/glossary" className="mt-auto text-sm font-medium text-teal-600 underline">
        Open the full glossary →
      </a>
    </div>
  );
}
