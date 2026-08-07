/**
 * <SandboxBanner> — persistent, unmissable banner on any sandbox-scoped
 * screen (§4.4, S1-4). The visible half of the flight-simulator switch; the
 * enforcing half lives in lib/integrations/registry-client.ts.
 */
import { useTranslations } from "next-intl";
import { InfoTip } from "./InfoTip";

export function SandboxBanner() {
  const t = useTranslations("sandbox");
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b-2 border-amber-700 bg-butter px-4 py-2 text-sm font-semibold text-amber-700"
    >
      <span aria-hidden>🧪</span>
      {t("banner")}
      <InfoTip termKey="sandbox_mode" />
    </div>
  );
}
