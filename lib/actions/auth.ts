"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_COOKIE, getCurrentUser, revokeSession, signIn } from "@/lib/auth";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  from: z.string().optional(),
});

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    from: formData.get("from") ?? undefined,
  });
  if (!parsed.success) redirect("/login?error=invalid_credentials");

  const h = await headers();
  const result = await signIn(parsed.data.email, parsed.data.password, {
    ip: h.get("x-forwarded-for") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  });

  if (!result.ok) redirect(`/login?error=${result.reason}`);

  const store = await cookies();
  store.set(SESSION_COOKIE, result.sealedSession, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 3600,
  });

  const from = parsed.data.from;
  redirect(from && from.startsWith("/") && !from.startsWith("//") ? from : "/");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await revokeSession(user.sessionId, user.id);
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function switchLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale") === "en" ? "en" : "hy";
  const store = await cookies();
  store.set("locale", locale, { path: "/", maxAge: 365 * 24 * 3600 });
  redirect("/login");
}
