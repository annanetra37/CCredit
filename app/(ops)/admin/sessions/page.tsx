import { desc, eq, isNull } from "drizzle-orm";
import { DataCard } from "@/components/DataCard";
import { Forbidden } from "@/components/Forbidden";
import { getDb, tables } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revokeSessionAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

/** S0-2: sessions stored in the database and individually revocable. */
export default async function SessionsAdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return <Forbidden />;

  const db = getDb();
  const sessions = await db
    .select({ session: tables.sessions, account: tables.users })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.sessions.userId, tables.users.id))
    .where(isNull(tables.sessions.revokedAt))
    .orderBy(desc(tables.sessions.createdAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink-900">Active sessions</h1>
      <DataCard layer="commercial" title="Sessions">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200">
            {sessions.map(({ session, account }) => (
              <tr key={session.id}>
                <td className="px-3 py-2 text-ink-900">{account.email}</td>
                <td className="px-3 py-2">{account.role}</td>
                <td className="numeric px-3 py-2 text-xs text-ink-500">
                  {session.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="numeric px-3 py-2 text-xs text-ink-500">
                  {session.expiresAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3 py-2">
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <button className="rounded-input bg-blush px-3 py-1 text-xs font-semibold text-rose-700">
                      Revoke
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataCard>
    </div>
  );
}
