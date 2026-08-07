/**
 * <StatusPill> — every lifecycle state, colour-mapped, with an InfoTip
 * explaining that state (§4.4). Pastel fill + deep accent text only.
 */
import { InfoTip } from "./InfoTip";

type PillTone = "mint" | "butter" | "blush" | "mist" | "peach" | "lilac" | "sand";

const TONE_CLASSES: Record<PillTone, string> = {
  mint: "bg-mint text-mint-700",
  butter: "bg-butter text-amber-700",
  blush: "bg-blush text-rose-700",
  mist: "bg-mist text-teal-600",
  peach: "bg-peach text-apricot-700",
  lilac: "bg-lilac text-lilac-700",
  sand: "bg-surface-2 text-ink-700",
};

const STATUS_TONE: Record<string, PillTone> = {
  // attribute lifecycle
  MEASURED: "mist",
  RECONCILED: "mint",
  DISPUTED: "blush",
  ELIGIBLE: "peach",
  ALLOCATED: "peach",
  ISSUED: "mint",
  TRANSFERRED: "sand",
  REDEEMED: "lilac",
  VOID: "blush",
  // site lifecycle
  LEAD: "sand",
  QUALIFYING: "sand",
  CONTRACTED: "mist",
  METERED: "mist",
  COMMISSIONED: "peach",
  ASSESSED: "peach",
  PRODUCING: "mint",
  SUSPENDED: "butter",
  TERMINATED: "blush",
  // generic
  OPEN: "sand",
  DRAFT: "sand",
  SUBMITTED: "mist",
  LOCKED: "butter",
  APPROVED: "mint",
  REJECTED: "blush",
  CHECKS_PASSED: "mint",
  ACTIVE: "mint",
};

/** Status → glossary key, where a state deserves an explanation. */
const STATUS_TERM: Record<string, string> = {
  RECONCILED: "reconciliation",
  DISPUTED: "tolerance",
  REDEEMED: "redemption",
  ISSUED: "i_rec",
  MEASURED: "manual_reading",
};

export function StatusPill({
  status,
  termKey,
}: {
  status: string;
  termKey?: string;
}) {
  const tone = STATUS_TONE[status] ?? "sand";
  const glossaryKey = termKey ?? STATUS_TERM[status];
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-badge px-3 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {status}
      {glossaryKey && <InfoTip termKey={glossaryKey} />}
    </span>
  );
}
