"use client";

import { useCallback } from "react";
import { Link2 } from "lucide-react";
import { getConnections } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { useLoad } from "@/lib/useLoad";
import { ConnectionCard } from "@/components/connections/connection-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Spinner } from "@/components/common/spinner";

export default function ConnectionsPage() {
  const t = useStrings();
  const { data, loading, error, reload } = useLoad(useCallback(() => getConnections(), []));

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
      <PageHeader title={t.connections.title} lead={t.connections.lead} />

      <div className="mt-5 flex flex-col gap-3">
        {data.length === 0 ? (
          <EmptyState
            icon={<Link2 className="size-8 text-zinc-300" />}
            title={t.connections.empty}
            body={t.connections.emptyBody}
          />
        ) : (
          data.map((connection) => (
            <ConnectionCard
              key={connection.clientId}
              connection={connection}
              onRevoked={() => void reload()}
            />
          ))
        )}
      </div>
    </div>
  );
}
