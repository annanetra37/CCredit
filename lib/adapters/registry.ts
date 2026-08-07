import type { ReadingSource, ReadingSourceKind } from "./reading-source";

/**
 * Adapter registry (S4-1): resolves the correct source per device. Downstream
 * domain logic is source-agnostic — no branching on source type outside this
 * layer.
 */
const sources = new Map<ReadingSourceKind, ReadingSource>();

export function registerSource(source: ReadingSource): void {
  sources.set(source.kind, source);
}

export function resolveSource(kind: ReadingSourceKind): ReadingSource {
  const s = sources.get(kind);
  if (!s) {
    throw new Error(
      `No adapter registered for source ${kind}. Register one at startup.`,
    );
  }
  return s;
}
