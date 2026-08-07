import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Forbidden } from "@/components/Forbidden";
import { canAccessGroup, getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessGroup(user.role, "ops")) return <Forbidden />;

  const t = await getTranslations("nav");
  const tc = await getTranslations("common");

  const nav: Array<[string, string]> = [
    ["/dashboard", t("dashboard")],
    ["/sites", t("sites")],
    ["/readings/manual", t("manualEntry")],
    ["/readings/import", t("bulkImport")],
    ["/reconciliation", t("reconciliation")],
    ["/attributes", t("attributes")],
    ["/issuance", t("issuance")],
    ["/audit", t("audit")],
    ["/glossary", t("glossary")],
  ];
  if (user.role === "admin") {
    nav.push(["/admin/sessions", t("admin")], ["/admin/glossary", `${t("admin")}: ${t("glossary")}`]);
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-ink-200 bg-surface-1 p-4 sm:flex">
        <p className="mb-3 text-sm font-bold text-ink-900">{tc("appName")}</p>
        {nav.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-input px-3 py-2 text-sm text-ink-700 hover:bg-mist hover:text-teal-600"
          >
            {label}
          </Link>
        ))}
        <div className="mt-auto border-t border-ink-200 pt-3">
          <p className="text-xs text-ink-500">
            {user.name} · {user.role}
          </p>
          <form action={logoutAction}>
            <button className="mt-1 text-sm text-teal-600 underline">{tc("signOut")}</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
