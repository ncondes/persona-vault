"use client";

import { useCallback } from "react";
import { Activity } from "lucide-react";
import { getAppActivity } from "@/lib/api";
import { useLocale, useStrings } from "@/lib/locale";
import { useLoad } from "@/lib/useLoad";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Spinner } from "@/components/common/spinner";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl px-4 py-3 ring-1 ring-foreground/10">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-[20px] font-medium">{value}</p>
    </div>
  );
}

export function AppActivity({ id }: { id: string }) {
  const t = useStrings();
  const { locale } = useLocale();
  const { data, loading, error } = useLoad(useCallback(() => getAppActivity(id), [id]));

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
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{t.console.activity.lead}</p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label={t.console.activity.users} value={data.users} />
        <Stat label={t.console.activity.grants} value={data.grants} />
        <Stat label={t.console.activity.releases} value={data.releases} />
        <Stat label={t.console.activity.revocations} value={data.revocations} />
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t.console.activity.recent}
        </p>
        {data.recent.length === 0 ? (
          <EmptyState
            icon={<Activity className="size-8 text-zinc-300" />}
            title={t.console.activity.empty}
            body={t.console.activity.emptyBody}
          />
        ) : (
          <Card className="py-0">
            <CardContent className="divide-y divide-zinc-100 px-0">
              {data.recent.map((event, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">{t.console.activity.types[event.type]}</p>
                    <p className="mt-0.5 font-mono text-[12px] break-words text-muted-foreground">
                      {event.scopes.join(" ") || "—"}
                    </p>
                  </div>
                  <time className="shrink-0 text-[12.5px] text-muted-foreground">
                    {new Date(event.at).toLocaleString(locale, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
