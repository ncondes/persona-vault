"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, IdCard, Link2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStrings } from "@/lib/locale";
import type { Strings } from "@/lib/strings";

export const NAV_ITEMS = [
  { href: "/vault", key: "vault", icon: IdCard },
  { href: "/connections", key: "connections", icon: Link2 },
  { href: "/contexts", key: "contexts", icon: Compass },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

export function pageTitle(pathname: string, t: Strings): string {
  const item = NAV_ITEMS.find((entry) => pathname.startsWith(entry.href));
  return item ? t.nav[item.key] : t.appName;
}

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
