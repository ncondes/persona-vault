"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCatalog } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { useLoad } from "@/lib/useLoad";
import type { ScopeMeta } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { Spinner } from "@/components/common/spinner";

function ScopeEntry({ meta }: { meta: ScopeMeta }) {
  const t = useStrings();
  const sample = JSON.stringify(meta.sample, null, 2);

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-medium">{t.scopes[meta.scope] ?? meta.scope}</span>
        <code className="font-mono text-[12px] text-muted-foreground">{meta.scope}</code>
        {meta.sensitive ? (
          <Badge className="bg-sensitive-bg2 text-sensitive border-transparent">
            {t.console.scopes.sensitive}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-[13.5px] text-muted-foreground">
        {t.console.scopes.desc[meta.scope] ?? ""}
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg bg-zinc-50 px-3.5 py-2.5 ring-1 ring-zinc-200/70">
        <pre className="font-mono text-[12px] leading-relaxed whitespace-pre">
          {`"${meta.scope}": ${sample}`}
        </pre>
      </div>
    </div>
  );
}

export default function ScopeReferencePage() {
  const t = useStrings();
  const { data, loading, error } = useLoad(useCallback(() => getCatalog(), []));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return <p className="py-10 text-sm text-destructive">{t.common.somethingWrong}</p>;
  }

  const unshareable = Object.entries(data.kinds)
    .filter(([, meta]) => meta.scope === null)
    .map(([kind]) => kind);

  return (
    <div className="max-w-2xl">
      <Link
        href="/console"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {t.console.back}
      </Link>

      <PageHeader title={t.console.reference.title} lead={t.console.reference.lead} />

      <div className="mt-5 flex flex-col gap-6">
        {data.scopeGroups.map((group) => {
          const rows = data.scopes.filter((meta) => meta.group === group);
          if (rows.length === 0) return null;
          return (
            <section key={group}>
              <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5">
                <h2 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t.console.scopes.groups[group]}
                </h2>
                <p className="text-[12.5px] text-muted-foreground">
                  {t.console.scopes.groupHints[group]}
                </p>
              </div>
              <Card className="py-0">
                <CardContent className="divide-y divide-zinc-100 px-0">
                  {rows.map((meta) => (
                    <ScopeEntry key={meta.scope} meta={meta} />
                  ))}
                </CardContent>
              </Card>
            </section>
          );
        })}

        {unshareable.length > 0 ? (
          <p className="text-[13px] text-muted-foreground">
            {t.console.reference.unshareable}:{" "}
            <span className="font-mono">{unshareable.join(", ")}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
