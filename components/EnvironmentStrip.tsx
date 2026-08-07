/**
 * The environment must be visually obvious at all times (§9): a persistent
 * coloured strip at the top of the viewport. An operator who cannot instantly
 * tell whether they are in sandbox or production will eventually do something
 * expensive.
 */
import { useTranslations } from "next-intl";

export function EnvironmentStrip() {
  const t = useTranslations("common.environment");
  const env = (process.env.APP_ENV ?? "local") as "local" | "sandbox" | "production";

  const styles: Record<typeof env, string> = {
    local: "bg-surface-2 text-ink-700",
    sandbox: "bg-butter text-amber-700",
    production: "bg-mint text-mint-700",
  };

  return (
    <div
      className={`px-4 py-0.5 text-center text-[11px] font-bold uppercase tracking-widest ${styles[env]}`}
    >
      {t(env)}
    </div>
  );
}
