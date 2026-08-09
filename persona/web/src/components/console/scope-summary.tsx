"use client";

import { useStrings } from "@/lib/locale";
import type { ScopeMeta } from "@/lib/types";
import type { ScopeSelection } from "@/lib/scope-selection";
import { cn } from "@/lib/utils";

// Three counts, so the shape of the request is legible before reading the list.
export function ScopeSummary({
  scopes,
  selection,
  className,
}: {
  scopes: ScopeMeta[];
  selection: ScopeSelection;
  className?: string;
}) {
  const t = useStrings();
  const chosen = Object.keys(selection);
  const required = chosen.filter((scope) => selection[scope] === "required").length;
  const sensitive = chosen.filter(
    (scope) => scopes.find((meta) => meta.scope === scope)?.sensitive,
  ).length;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <span className="bg-brand-tint text-brand rounded-full px-2.5 py-1 text-[12.5px] font-medium">
        {t.console.scopeCount(chosen.length)}
      </span>
      <span className="rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground">
        {required} {t.console.scopes.required.toLowerCase()}
      </span>
      {sensitive > 0 ? (
        <span className="bg-sensitive-bg text-sensitive ring-sensitive-border rounded-full px-2.5 py-1 text-[12.5px] font-medium ring-1">
          {t.console.sensitiveCount(sensitive)}
        </span>
      ) : null}
    </div>
  );
}
