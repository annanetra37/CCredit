/**
 * <TraceLink> — any number that can be drilled to source renders as this
 * (§4.4, S8-3). Visually distinct, always clickable, keyboard navigable, and
 * the drill path is shareable as a URL.
 */
import Link from "next/link";

export function TraceLink({
  value,
  unit,
  href,
}: {
  value: string | number;
  unit?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="numeric inline-flex items-baseline gap-1 rounded-input border-b-2 border-dotted border-teal-600 px-0.5 font-medium text-teal-600 hover:bg-mist"
      title="Trace this figure to its source"
    >
      {value}
      {unit && <span className="text-xs text-ink-500">{unit}</span>}
      <span aria-hidden className="text-xs">⌕</span>
    </Link>
  );
}
