"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { ACCENT_NAMES, accentHex, initialsOfApp } from "@/lib/accents";
import { useStrings } from "@/lib/locale";
import { cn } from "@/lib/utils";

export interface AppDraft {
  name: string;
  description: string;
  purpose: string;
  accent: string;
  redirectUris: string[];
}

export function AppIdentityFields({
  draft,
  purposes,
  errors,
  onChange,
}: {
  draft: AppDraft;
  purposes: string[];
  errors: Record<string, string>;
  onChange: (next: AppDraft) => void;
}) {
  const t = useStrings();
  const set = (patch: Partial<AppDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <Field label={t.console.form.name} error={errors.name}>
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} />
      </Field>

      <Field
        label={t.console.form.description}
        hint={t.console.form.descriptionHint}
        error={errors.description}
      >
        <Input
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          maxLength={200}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.console.form.purpose} hint={t.console.form.purposeHint} error={errors.purpose}>
          <Select value={draft.purpose} onValueChange={(purpose) => set({ purpose })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {purposes.map((purpose) => (
                <SelectItem key={purpose} value={purpose}>
                  {t.console.purposes[purpose] ?? purpose}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t.console.form.accent} hint={t.console.form.accentHint}>
          <div className="flex items-center gap-2.5">
            <div className="flex flex-wrap gap-1.5">
              {ACCENT_NAMES.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  aria-label={accent}
                  aria-pressed={draft.accent === accent}
                  onClick={() => set({ accent })}
                  style={{ backgroundColor: accentHex(accent) }}
                  className={cn(
                    "size-6 rounded-md transition-shadow",
                    draft.accent === accent &&
                      "ring-2 ring-foreground/70 ring-offset-2 ring-offset-white",
                  )}
                />
              ))}
            </div>
            <div
              aria-hidden
              style={{ backgroundColor: accentHex(draft.accent) }}
              className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold text-white"
            >
              {initialsOfApp(draft.name || "··")}
            </div>
          </div>
        </Field>
      </div>
    </div>
  );
}

export function RedirectUriFields({
  uris,
  error,
  onChange,
}: {
  uris: string[];
  error?: string;
  onChange: (next: string[]) => void;
}) {
  const t = useStrings();

  return (
    <Field label={t.console.form.redirectUris} hint={t.console.form.redirectUrisHint} error={error}>
      <div className="flex flex-col gap-2">
        {uris.map((uri, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={uri}
              inputMode="url"
              placeholder="https://example.com/callback"
              className="font-mono text-[13px]"
              onChange={(e) => onChange(uris.map((v, i) => (i === index ? e.target.value : v)))}
            />
            {uris.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t.console.form.removeUri}
                className="size-9 shrink-0"
                onClick={() => onChange(uris.filter((_, i) => i !== index))}
              >
                <X />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {uris.length < 5 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2.5"
          onClick={() => onChange([...uris, ""])}
        >
          <Plus data-icon="inline-start" />
          {t.console.form.addUri}
        </Button>
      ) : null}
    </Field>
  );
}
