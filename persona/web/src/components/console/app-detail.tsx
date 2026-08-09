"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getApp, getCatalog } from "@/lib/api";
import { accentHex, initialsOfApp } from "@/lib/accents";
import { useStrings } from "@/lib/locale";
import { useLoad } from "@/lib/useLoad";
import type { AppView } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/common/spinner";
import { AppActivity } from "@/components/console/app-activity";
import { AppOverview } from "@/components/console/app-overview";
import { AppScopes } from "@/components/console/app-scopes";

type Tab = "overview" | "scopes" | "activity";

export function AppDetail({ id }: { id: string }) {
  const t = useStrings();
  const loaded = useLoad(useCallback(() => getApp(id), [id]));
  const catalog = useLoad(useCallback(() => getCatalog(), []));
  const [tab, setTab] = useState<Tab>("overview");
  const [local, setLocal] = useState<AppView | null>(null);

  const app = local ?? loaded.data;

  if (loaded.loading || catalog.loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (loaded.error || catalog.error || !app || !catalog.data) {
    return <p className="py-10 text-sm text-destructive">{t.common.somethingWrong}</p>;
  }

  // Only the Scopes tab needs the wide column; the rest stay in the app's
  // normal reading width.
  const wide = tab === "scopes";

  return (
    <div className={wide ? "max-w-6xl" : "max-w-2xl"}>
      <Link
        href="/console"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {t.console.back}
      </Link>

      <header className="flex items-start gap-3.5">
        <div
          aria-hidden
          style={{ backgroundColor: accentHex(app.accent) }}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold text-white"
        >
          {initialsOfApp(app.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{app.name}</h1>
            <Badge variant="secondary">{t.console.purposes[app.purpose] ?? app.purpose}</Badge>
            {app.status === "disabled" ? (
              <Badge className="bg-sensitive-bg2 text-sensitive border-transparent">
                {t.console.status.disabled}
              </Badge>
            ) : null}
          </div>
          {app.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
          ) : null}
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="mt-5">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview">{t.console.tabs.overview}</TabsTrigger>
          <TabsTrigger value="scopes">{t.console.tabs.scopes}</TabsTrigger>
          <TabsTrigger value="activity">{t.console.tabs.activity}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-6">
        {tab === "overview" ? (
          <AppOverview app={app} catalog={catalog.data} onChanged={setLocal} />
        ) : null}
        {tab === "scopes" ? (
          <AppScopes app={app} catalog={catalog.data} onSaved={setLocal} />
        ) : null}
        {tab === "activity" ? <AppActivity id={app.id} /> : null}
      </div>
    </div>
  );
}
