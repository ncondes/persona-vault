"use client";

import { useLocale } from "@/lib/locale";
import type { Locale } from "@/lib/strings";
import { cn } from "@/lib/utils";

const LOCALES: Locale[] = ["en", "es"];

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-zinc-200 bg-white p-0.5 text-xs font-semibold",
        className,
      )}
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          className={cn(
            "rounded-full px-2.5 py-1 uppercase transition-colors",
            option === locale ? "bg-brand text-white" : "text-zinc-500 hover:text-zinc-800",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
