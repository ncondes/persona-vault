"use client";

import { Check } from "lucide-react";
import { useStrings } from "@/lib/locale";
import type { Strings } from "@/lib/strings";
import { docDetail, nameDetail, type InteractionField, type InteractionOption } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function optionText(t: Strings, field: InteractionField, option: InteractionOption): string {
  let value = option.value;
  const name = nameDetail(option.detail);
  if (field.scope === "given_name" && name) value = name.firstName;
  if (field.scope === "family_name" && name) value = name.lastName;
  if (field.kind === "blood_type") value = t.catalog.bloodTypes[value] ?? value;
  if (field.kind === "eps") value = t.catalog.epsProviders[value] ?? value;
  const doc = field.kind === "document" ? docDetail(option.detail) : null;
  if (doc) value = `${doc.type} ${value}`;
  const chip = option.nameContext
    ? t.vault.nameContexts[option.nameContext]
    : option.label;
  return chip ? `${value} · ${chip}` : value;
}

interface ConsentFieldCardProps {
  field: InteractionField;
  selected: string[];
  enabled: boolean;
  onSelect: (ids: string[]) => void;
  onToggle: (enabled: boolean) => void;
}

// One requested field on the consent screen: its value (or picker), the
// required/sensitive treatment, and the on/off switch for optional sensitive data.
export function ConsentFieldCard({ field, selected, enabled, onSelect, onToggle }: ConsentFieldCardProps) {
  const t = useStrings();
  const sensitiveTone = field.sensitive;

  const picker =
    field.kind === "allergy" ? (
      <div className="mt-2 space-y-1.5">
        {field.options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border bg-white px-3 py-2 text-sm",
                sensitiveTone ? "border-sensitive-border" : "border-zinc-200",
              )}
            >
              <input
                type="checkbox"
                className="accent-brand size-4"
                checked={checked}
                disabled={!enabled}
                onChange={() =>
                  onSelect(
                    checked ? selected.filter((id) => id !== option.id) : [...selected, option.id],
                  )
                }
              />
              {option.value}
            </label>
          );
        })}
      </div>
    ) : field.options.length > 1 ? (
      <Select value={selected[0]} onValueChange={(id) => onSelect([id])} disabled={!enabled}>
        <SelectTrigger
          className={cn("mt-2 w-full bg-white", sensitiveTone && "border-sensitive-border")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {optionText(t, field, option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : field.options.length === 1 ? (
      <p className={cn("mt-1.5 text-[15px]", !enabled && "text-zinc-400 line-through")}>
        {optionText(t, field, field.options[0])}
      </p>
    ) : null;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        sensitiveTone ? "border-sensitive-border bg-sensitive-bg" : "border-zinc-200 bg-white",
        !enabled && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t.scopes[field.scope] ?? field.scope}</span>
          {field.required ? <Badge variant="secondary">{t.common.requiredBadge}</Badge> : null}
          {field.sensitive ? (
            <Badge className="bg-sensitive-bg2 text-sensitive border-sensitive-border">
              {t.common.sensitiveBadge}
            </Badge>
          ) : null}
        </div>
        {field.sensitive && !field.required ? (
          <Switch checked={enabled} onCheckedChange={onToggle} />
        ) : (
          <Check className="text-brand size-4" />
        )}
      </div>
      {picker}
    </div>
  );
}
