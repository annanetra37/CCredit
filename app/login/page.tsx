import { getTranslations } from "next-intl/server";
import { loginAction, switchLocaleAction } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");
  const params = await searchParams;

  const errorMessages: Record<string, string> = {
    invalid_credentials: t("invalidCredentials"),
    account_expired: t("accountExpired"),
    account_disabled: t("accountExpired"),
  };
  const error = params.error ? (errorMessages[params.error] ?? t("invalidCredentials")) : null;

  return (
    <main className="flex min-h-[80dvh] items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-bold text-ink-900">
          {tc("appName")}
        </h1>
        <p className="mb-6 text-center text-sm text-ink-500">☀️ → 📜 → 💰</p>

        <form
          action={loginAction}
          className="flex flex-col gap-4 rounded-card bg-surface-1 p-6 shadow-soft"
        >
          <input type="hidden" name="from" value={params.from ?? ""} />
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            {t("email")}
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3 text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
            {t("password")}
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="min-h-11 rounded-input border border-ink-200 bg-surface-1 px-3 text-ink-900"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-input bg-blush px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="min-h-11 rounded-input bg-teal-600 text-sm font-semibold text-white hover:opacity-90"
          >
            {t("signIn")}
          </button>
        </form>

        <form action={switchLocaleAction} className="mt-4 flex justify-center gap-2">
          <button name="locale" value="hy" className="rounded-badge px-3 py-1 text-sm text-teal-600 hover:bg-mist">
            Հայերեն
          </button>
          <button name="locale" value="en" className="rounded-badge px-3 py-1 text-sm text-teal-600 hover:bg-mist">
            English
          </button>
        </form>
      </div>
    </main>
  );
}
