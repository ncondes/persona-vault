"use client";

import { Pencil, Trash2 } from "lucide-react";
import { t } from "@/lib/strings";
import type { VaultItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function displayValue(item: VaultItem): string {
  if (item.kind === "blood_type") return t.catalog.bloodTypes[item.value] ?? item.value;
  if (item.kind === "eps") return t.catalog.epsProviders[item.value] ?? item.value;
  return item.value;
}

interface ValueRowProps {
  item: VaultItem;
  canMakeDefault: boolean;
  onMakeDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ValueRow({ item, canMakeDefault, onMakeDefault, onEdit, onDelete }: ValueRowProps) {
  const chip =
    item.nameContext !== null ? t.vault.nameContexts[item.nameContext] : (item.label ?? null);

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={item.kind === "document" ? "font-mono text-[15px]" : "text-[15px]"}>
            {displayValue(item)}
          </span>
          {chip ? <Badge variant="secondary">{chip}</Badge> : null}
          {item.isDefault ? (
            <Badge className="bg-brand-tint text-brand border-transparent">
              {t.common.defaultBadge}
            </Badge>
          ) : null}
        </div>
        {item.kind === "document" && item.detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.catalog.documentTypes[item.detail.type] ?? item.detail.type} ·{" "}
            {t.vault.documentFields.issueDate.toLowerCase()} {item.detail.issueDate},{" "}
            {item.detail.issuePlace}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!item.isDefault && canMakeDefault ? (
          <Button variant="ghost" size="sm" className="text-brand" onClick={onMakeDefault}>
            {t.common.makeDefault}
          </Button>
        ) : null}
        <Button variant="ghost" size="icon-sm" onClick={onEdit} title={t.common.edit}>
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          title={t.common.delete}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
