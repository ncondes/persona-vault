"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { getMe } from "@/lib/api";
import { t } from "@/lib/strings";
import { useLoad } from "@/lib/useLoad";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/common/logo";
import { NavLinks, pageTitle } from "./nav";
import { UserCard, initialsOf } from "./user-card";

// The authenticated frame: fixed sidebar on desktop, top bar + drawer on mobile.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useLoad(getMe);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const brand = (
    <div className="flex items-center gap-2.5 px-2">
      <Logo size="sm" />
      <span className="text-base font-semibold tracking-tight">{t.appName}</span>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-[262px] shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        {brand}
        <NavLinks />
        <div className="mt-auto">
          <UserCard user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-zinc-100 px-4 lg:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[300px] flex-col gap-6 bg-sidebar p-4">
              <SheetHeader className="p-0">
                <SheetTitle asChild>{brand}</SheetTitle>
              </SheetHeader>
              <NavLinks onNavigate={() => setDrawerOpen(false)} />
              <div className="mt-auto">
                <UserCard user={user} />
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="flex-1 text-lg font-semibold tracking-tight">{pageTitle(pathname)}</h1>
          <div className="bg-brand flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white">
            {user ? initialsOf(user.email) : "…"}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
