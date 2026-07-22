"use client";

import { useState } from "react";
import { ApiError, createItem, updateItem } from "@/lib/api";
import { t } from "@/lib/strings";
import type { Catalog, NameContext, VaultItem, VaultKind } from "@/lib/types";
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

const LABELED_KINDS: VaultKind[] = ["email", "phone", "address", "document"];
const NAME_CONTEXTS: NameContext[] = ["legal", "preferred", "professional", "public"];

interface ItemFormProps {
  kind: VaultKind;
  catalog: Catalog | null;
  item?: VaultItem;
  submitLabel?: string;
  onSaved: () => void;
  onCancel?: () => void;
}

// Add/edit form for one vault item; the controls adapt to the kind.
export function ItemForm({ kind, catalog, item, submitLabel, onSaved, onCancel }: ItemFormProps) {
  const [value, setValue] = useState(item?.value ?? "");
  const [label, setLabel] = useState(item?.label ?? "");
  const [nameContext, setNameContext] = useState<NameContext>(item?.nameContext ?? "preferred");
  const [docType, setDocType] = useState(item?.detail?.type ?? "CC");
  const [issueDate, setIssueDate] = useState(item?.detail?.issueDate ?? "");
  const [issuePlace, setIssuePlace] = useState(item?.detail?.issuePlace ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      value: value.trim(),
      label: LABELED_KINDS.includes(kind) && label.trim() ? label.trim() : null,
      nameContext: kind === "name" ? nameContext : undefined,
      detail: kind === "document" ? { type: docType, issueDate, issuePlace } : undefined,
    };

    try {
      if (item) {
        await updateItem(item.id, payload);
      } else {
        await createItem({ kind, ...payload });
      }
      onSaved();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (t.vault.errors[err.code] ?? Object.values(err.fields ?? {})[0] ?? err.message)
          : t.common.somethingWrong;
      setError(message);
      setBusy(false);
    }
  };

  const codeSelect = (codes: string[], labels: Record<string, string>) => (
    <Select value={value} onValueChange={setValue} required>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {codes.map((code) => (
          <SelectItem key={code} value={code}>
            {labels[code] ?? code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      {kind === "name" ? (
        <Field label={t.vault.nameContextLabel}>
          <Select value={nameContext} onValueChange={(v) => setNameContext(v as NameContext)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NAME_CONTEXTS.map((context) => (
                <SelectItem key={context} value={context}>
                  {t.vault.nameContexts[context]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {kind === "blood_type" ? (
        <Field label={t.vault.kinds.blood_type}>
          {codeSelect(catalog?.bloodTypes ?? [], t.catalog.bloodTypes)}
        </Field>
      ) : kind === "eps" ? (
        <Field label={t.vault.kinds.eps}>
          {codeSelect(catalog?.epsProviders ?? [], t.catalog.epsProviders)}
        </Field>
      ) : (
        <Field label={kind === "document" ? t.vault.documentFields.number : t.vault.kinds[kind]}>
          <Input
            type={kind === "birth_date" ? "date" : kind === "email" ? "email" : "text"}
            className={kind === "document" ? "font-mono" : undefined}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      )}

      {kind === "document" ? (
        <div className="grid grid-cols-3 gap-3">
          <Field label={t.vault.documentFields.type}>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(catalog?.documentTypes ?? []).map((code) => (
                  <SelectItem key={code} value={code}>
                    {t.catalog.documentTypes[code] ?? code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.vault.documentFields.issueDate}>
            <Input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </Field>
          <Field label={t.vault.documentFields.issuePlace}>
            <Input required value={issuePlace} onChange={(e) => setIssuePlace(e.target.value)} />
          </Field>
        </div>
      ) : null}

      {LABELED_KINDS.includes(kind) ? (
        <Field label={t.vault.label}>
          <Input placeholder={t.vault.labelHint} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {submitLabel ?? t.common.save}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {t.common.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
