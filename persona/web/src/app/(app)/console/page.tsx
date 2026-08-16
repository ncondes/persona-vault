"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ChevronRight, SquareTerminal } from "lucide-react";
import { getApps } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { useLoad } from "@/lib/useLoad";
import { accentHex, initialsOfApp } from "@/lib/accents";
import type { AppView } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Spinner } from "@/components/common/spinner";

function AppRow({ app }: { app: AppView }) {
  const t = useStrings();

  return (
    <Link
      href={`/console/${app.id}`}
      className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/50"
    >
      <div
        aria-hidden
        style={{ backgroundColor: accentHex(app.accent) }}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-semibold text-white"
      >
        {initialsOfApp(app.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-medium">{app.name}</span>
          <Badge variant="secondary">{t.console.purposes[app.purpose] ?? app.purpose}</Badge>
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {t.console.scopeCount(app.allowedScopes.length)}
        </p>
      </div>

      <span className="hidden items-center gap-2 text-[13px] text-muted-foreground sm:flex">
        <span
          aria-hidden
          className={`size-1.5 rounded-full ${app.status === "active" ? "bg-brand" : "bg-zinc-300"}`}
        />
        {t.console.status[app.status]}
      </span>
      <ChevronRight className="size-4 shrink-0 text-zinc-300" />
    </Link>
  );
}

export default function ConsolePage() {
  const t = useStrings();
  const { data, loading, error } = useLoad(useCallback(() => getApps(), []));

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

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeader title={t.console.title} lead={t.console.lead} />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="lg">
            <Link href="/docs">{t.console.getStarted}</Link>
          </Button>
          {data.length > 0 ? (
            <Button asChild size="lg">
              <Link href="/console/new">{t.console.register}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        {data.length === 0 ? (
          <EmptyState
            icon={<SquareTerminal className="size-8 text-zinc-300" />}
            title={t.console.empty}
            body={t.console.emptyBody}
            action={
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Button asChild size="xl">
                  <Link href="/console/new">{t.console.register}</Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link href="/docs">{t.console.getStarted}</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <Card className="py-0">
            <CardContent className="divide-y divide-zinc-100 px-0">
              {data.map((app) => (
                <AppRow key={app.id} app={app} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
