import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/** Land each role on its home surface. */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  switch (user.role) {
    case "owner":
      redirect("/portal");
    case "vendor":
      redirect("/fleet");
    case "auditor":
      redirect("/console");
    default:
      redirect("/dashboard");
  }
}
