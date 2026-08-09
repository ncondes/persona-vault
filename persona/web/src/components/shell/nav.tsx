"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStrings } from "@/lib/locale";
import { NAV_ITEMS } from "@/lib/nav";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useStrings();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-zinc-600 hover:bg-zinc-100",
            )}
          >
            <Icon className="size-4" />
            {t.nav[key]}
          </Link>
        );
      })}
    </nav>
  );
}
