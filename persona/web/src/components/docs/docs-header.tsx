"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getDocsContent } from "@/lib/docs-content";
import { useLocale } from "@/lib/locale";
import { LanguageToggle } from "@/components/common/language-toggle";
import { Logo } from "@/components/common/logo";

// The docs live outside the app shell, so they carry their own top chrome: the
// mark home, a link back into the console, and the language toggle.
export function DocsHeader() {
  const { locale } = useLocale();
  const d = getDocsContent(locale);

  return (
    <header className="sticky top-0 z-20 border-b border-foreground/10 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Logo href="/" size="sm" />
          <span className="text-sm font-semibold tracking-tight">Persona</span>
          <span className="hidden text-[11px] font-semibold tracking-wide text-brand uppercase sm:inline">
            {d.eyebrow}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/console"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {d.openConsole}
            <ArrowUpRight className="size-3.5" />
          </Link>
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
