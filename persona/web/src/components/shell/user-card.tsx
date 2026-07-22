"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function initialsOf(text: string): string {
  return text.slice(0, 2).toUpperCase();
}

export function UserCard({ user }: { user: User | null }) {
  const t = useStrings();
  const signOut = async () => {
    await logout();
    window.location.assign("/login");
  };

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white p-2.5">
      <div className="bg-brand flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
        {user ? initialsOf(user.email) : "…"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user?.email ?? t.common.loading}</p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={signOut} title={t.nav.logout}>
        <LogOut />
      </Button>
    </div>
  );
}
