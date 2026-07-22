import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";

// Cheap gate: no cookie means definitely signed out. An expired token still
// passes here — the first API call then 401s and the client redirects.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  if (!cookieStore.has("token")) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
