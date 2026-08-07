import { useTranslations } from "next-intl";

/** Unauthorised returns 403, not a redirect loop (S0-2). */
export function Forbidden() {
  const t = useTranslations("auth");
  return (
    <main className="flex min-h-[60dvh] items-center justify-center p-8">
      <div className="rounded-card bg-blush p-6 text-center">
        <p className="text-2xl font-bold text-rose-700">403</p>
        <p className="mt-2 text-sm text-ink-900">{t("forbidden")}</p>
      </div>
    </main>
  );
}
