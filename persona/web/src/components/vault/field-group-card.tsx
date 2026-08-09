"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { deleteItem, updateItem } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { KIND_SCOPE } from "@/lib/sections";
import type { Catalog, Connection, VaultItem, VaultKind } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useToast } from "@/components/common/toast";
import { ItemForm } from "./item-form";
import { ValueRow } from "./value-row";

interface FieldGroupCardProps {
  kind: VaultKind;
  items: VaultItem[];
  catalog: Catalog | null;
  connections: Connection[];
  onChanged: () => void;
}

// One card per kind: its values, add/edit forms, and which apps use it.
export function FieldGroupCard({ kind, items, catalog, connections, onChanged }: FieldGroupCardProps) {
  const t = useStrings();
  const notify = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const meta = catalog?.kinds[kind];
  const canAdd = meta ? meta.multi || items.length === 0 : items.length === 0;
  const sensitive = meta?.sensitive ?? items[0]?.sensitive ?? false;

  const usedBy = connections
    .filter((c) => c.shared.some((s) => s.scope === KIND_SCOPE[kind]))
    .map((c) => c.clientName);

  const saved = () => {
    setAdding(false);
    setEditingId(null);
    onChanged();
  };

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t.vault.kinds[kind]}</h3>
          {sensitive ? (
            <Badge className="bg-sensitive-bg2 text-sensitive border-sensitive-border">
              {t.common.sensitiveBadge}
            </Badge>
          ) : null}
          <div className="flex-1" />
          {canAdd && !adding ? (
            <Button variant="ghost" size="sm" className="text-brand" onClick={() => setAdding(true)}>
              <Plus data-icon="inline-start" />
              {t.common.add}
            </Button>
          ) : null}
        </div>

        {items.length === 0 && !adding ? (
          <p className="mt-2 text-sm text-zinc-400">{t.vault.emptyGroup(t.vault.kinds[kind])}</p>
        ) : (
          <div className="mt-1 divide-y divide-zinc-100">
            {items.map((item) =>
              editingId === item.id ? (
                <div key={item.id} className="py-3">
                  <ItemForm
                    kind={kind}
                    catalog={catalog}
                    item={item}
                    onSaved={saved}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <ValueRow
                  key={item.id}
                  item={item}
                  canMakeDefault={(meta?.multi ?? false) && items.length > 1}
                  onMakeDefault={() => updateItem(item.id, { isDefault: true }).then(onChanged)}
                  onEdit={() => setEditingId(item.id)}
                  onDelete={() => setDeletingId(item.id)}
                />
              ),
            )}
          </div>
        )}

        {adding ? (
          <div className="mt-3">
            <ItemForm kind={kind} catalog={catalog} onSaved={saved} onCancel={() => setAdding(false)} />
          </div>
        ) : null}

        {usedBy.length > 0 ? (
          <>
            <Separator className="my-3" />
            <p className="text-xs text-muted-foreground">
              {t.vault.usedIn}{" "}
              <span className="text-brand font-medium">{usedBy.join(" · ")}</span>
            </p>
          </>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title={t.common.delete}
        body={t.vault.deleteConfirm}
        confirmLabel={t.common.delete}
        onConfirm={async () => {
          if (deletingId) await deleteItem(deletingId);
          notify.success(t.vault.deleted);
          onChanged();
        }}
      />
    </Card>
  );
}
