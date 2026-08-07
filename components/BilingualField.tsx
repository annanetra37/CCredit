/**
 * <BilingualField> — label pairs for hy/en where both are stored (§4.4).
 * Used on contracts and glossary admin, where Armenian and English versions
 * of the same field sit side by side.
 */
import type { ReactNode } from "react";

export function BilingualField({
  label,
  hy,
  en,
}: {
  label: string;
  hy: ReactNode;
  en: ReactNode;
}) {
  return (
    <fieldset className="rounded-card border border-ink-200 p-3">
      <legend className="px-1 text-sm font-medium text-ink-700">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            Հայերեն
          </span>
          {hy}
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            English
          </span>
          {en}
        </div>
      </div>
    </fieldset>
  );
}
