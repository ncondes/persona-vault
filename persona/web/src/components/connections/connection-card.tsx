"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { revokeConnection } from "@/lib/api";
import { t } from "@/lib/strings";
import { docDetail, nameDetail, type Connection } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { initialsOf } from "@/components/shell/user-card";
import { cn } from "@/lib/utils";

function snapshotText(shared: Connection["shared"][number]): string {
  return shared.snapshot
    .map((s) => {
      let value = s.value;
      const name = nameDetail(s.detail);
      if (shared.scope === "given_name" && name) value = name.firstName;
      if (shared.scope === "family_name" && name) value = name.lastName;
      if (shared.scope === "blood_type") value = t.catalog.bloodTypes[value] ?? value;
      if (shared.scope === "eps") value = t.catalog.epsProviders[value] ?? value;
      const doc = shared.scope === "document" ? docDetail(s.detail) : null;
      if (doc) value = `${doc.type} ${value}`;
      return s.label ? `${value} (${s.label})` : value;
    })
    .join(", ");
}

export function ConnectionCard({
  connection,
  onRevoked,
}: {
  connection: Connection;
  onRevoked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const grantedAt = new Date(connection.grantedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className={cn(open && "border-brand ring-brand/10 ring-3")}>
      <CardContent>
        <button
          type="button"
          className="flex w-full items-center gap-3 text-left"
          onClick={() => setOpen(!open)}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-sm font-semibold text-zinc-700">
            {initialsOf(connection.clientName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{connection.clientName}</p>
            <p className="text-xs text-muted-foreground">
              {t.connections.itemCount(connection.shared.length)} · {grantedAt}
            </p>
          </div>
          <ChevronDown
            className={cn("size-4 text-zinc-400 transition-transform", open && "rotate-180")}
          />
        </button>

        {open ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t.connections.sharedData}
            </p>
            <div className="mt-2.5 space-y-2">
              {connection.shared.map((shared) => (
                <div key={shared.scope} className="flex items-start justify-between gap-4 text-sm">
                  <span className="flex shrink-0 items-center gap-1.5 text-zinc-600">
                    {t.scopes[shared.scope] ?? shared.scope}
                    {shared.sensitive ? (
                      <Badge className="bg-sensitive-bg2 text-sensitive border-sensitive-border px-1.5 py-0 text-[9px]">
                        {t.common.sensitiveBadge.toLowerCase()}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-right font-medium">{snapshotText(shared)}</span>
                </div>
              ))}
            </div>
            <Button
              variant="destructive"
              className="mt-4 w-full"
              onClick={() => setConfirming(true)}
            >
              {t.connections.revoke}
            </Button>
          </div>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.connections.revoke}
        body={t.connections.revokeConfirm(connection.clientName)}
        confirmLabel={t.connections.revoke}
        onConfirm={async () => {
          await revokeConnection(connection.clientId);
          onRevoked();
        }}
      />
    </Card>
  );
}
