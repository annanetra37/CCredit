import {
  SITE_STATUSES,
  validateSiteTransition,
  type SiteStatus,
} from "@/lib/domain/ledger/site-machine";

export function legalNextStatuses(from: SiteStatus): SiteStatus[] {
  return SITE_STATUSES.filter((to) => validateSiteTransition(from, to).ok);
}
