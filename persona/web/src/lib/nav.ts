import { Compass, IdCard, Link2, Settings, SquareTerminal } from "lucide-react";
import type { Strings } from "@/lib/strings";

export const NAV_ITEMS = [
  { href: "/vault", key: "vault", icon: IdCard },
  { href: "/connections", key: "connections", icon: Link2 },
  { href: "/contexts", key: "contexts", icon: Compass },
  { href: "/console", key: "console", icon: SquareTerminal },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

// Matched by prefix, so every page under a section carries that section's title
// — /console/scopes reads as "Console", not as nothing.
export function pageTitle(pathname: string, t: Strings): string {
  const item = NAV_ITEMS.find((entry) => pathname.startsWith(entry.href));
  return item ? t.nav[item.key] : t.appName;
}
