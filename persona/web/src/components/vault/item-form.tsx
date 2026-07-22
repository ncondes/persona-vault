"use client";

import { useState } from "react";
import { ApiError, createItem, updateItem } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import {
  type Catalog,
  type ItemDetail,
  type NameContext,
  type VaultItem,
  type VaultKind,
} from "@/lib/types";
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
import { Flag } from "@/components/common/flag";

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

// Add/edit form for one vault item; the controls adapt to the kind. For name,
// phone and address the parts are sent and the server composes the value.
export function ItemForm({ kind, catalog, item, submitLabel, onSaved, onCancel }: ItemFormProps) {
  const t = useStrings();
  const [value, setValue] = useState(item?.value ?? "");
  const [label, setLabel] = useState(item?.label ?? "");
  const [nameContext, setNameContext] = useState<NameContext>(item?.nameContext ?? "preferred");
  const [parts, setParts] = useState<Record<string, string>>(() => {
    const detail = item?.detail as Record<string, string> | undefined;
    return {
      countryCode: "+57",
      country: "CO",
      ...(detail ?? {}),
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const part = (key: string) => parts[key] ?? "";
  const setPart = (key: string, v: string) => setParts((p) => ({ ...p, [key]: v }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    let detail: ItemDetail | undefined;
    if (kind === "name") detail = { firstName: part("firstName"), lastName: part("lastName") };
    if (kind === "phone") detail = { countryCode: part("countryCode"), number: part("number") };
    if (kind === "address") {
      detail = {
        line1: part("line1"),
        line2: part("line2") || undefined,
        line3: part("line3") || undefined,
        city: part("city"),
        postalCode: part("postalCode") || undefined,
        country: part("country"),
      };
    }
    if (kind === "document") {
      detail = { type: part("type") || "CC", issueDate: part("issueDate"), issuePlace: part("issuePlace") };
    }

    const composed = kind === "name" || kind === "phone" || kind === "address";
    const payload = {
      value: composed ? undefined : value.trim(),
      label: LABELED_KINDS.includes(kind) && label.trim() ? label.trim() : null,
      nameContext: kind === "name" ? nameContext : undefined,
      detail,
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

  const countrySelect = (key: string) => (
    <Select value={part(key)} onValueChange={(v) => setPart(key, v)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(catalog?.countries ?? []).map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {t.catalog.countries[c.code] ?? c.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      {kind === "name" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.auth.firstName}>
              <Input required value={part("firstName")} onChange={(e) => setPart("firstName", e.target.value)} />
            </Field>
            <Field label={t.auth.lastName}>
              <Input required value={part("lastName")} onChange={(e) => setPart("lastName", e.target.value)} />
            </Field>
          </div>
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
        </>
      ) : null}

      {kind === "phone" ? (
        <div className="grid grid-cols-[6.5rem_1fr] gap-3">
          <Field label={t.vault.phoneFields.countryCode}>
            <Select value={part("countryCode")} onValueChange={(v) => setPart("countryCode", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(catalog?.countries ?? []).map((c) => (
                  <SelectItem key={c.code} value={c.dial}>
                    <span className="flex items-center gap-2">
                      <Flag code={c.code} /> {c.dial}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.vault.phoneFields.number}>
            <Input type="tel" required value={part("number")} onChange={(e) => setPart("number", e.target.value)} />
          </Field>
        </div>
      ) : null}

      {kind === "address" ? (
        <>
          <Field label={t.vault.addressFields.line1}>
            <Input required value={part("line1")} onChange={(e) => setPart("line1", e.target.value)} />
          </Field>
          <Field label={t.vault.addressFields.line2}>
            <Input value={part("line2")} onChange={(e) => setPart("line2", e.target.value)} />
          </Field>
          <Field label={t.vault.addressFields.line3}>
            <Input value={part("line3")} onChange={(e) => setPart("line3", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.vault.addressFields.city}>
              <Input required value={part("city")} onChange={(e) => setPart("city", e.target.value)} />
            </Field>
            <Field label={t.vault.addressFields.postalCode}>
              <Input value={part("postalCode")} onChange={(e) => setPart("postalCode", e.target.value)} />
            </Field>
          </div>
          <Field label={t.vault.addressFields.country}>{countrySelect("country")}</Field>
        </>
      ) : null}

      {kind === "blood_type" ? (
        <Field label={t.vault.kinds.blood_type}>
          {codeSelect(catalog?.bloodTypes ?? [], t.catalog.bloodTypes)}
        </Field>
      ) : kind === "eps" ? (
        <Field label={t.vault.kinds.eps}>
          {codeSelect(catalog?.epsProviders ?? [], t.catalog.epsProviders)}
        </Field>
      ) : kind === "name" || kind === "phone" || kind === "address" ? null : (
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
            <Select value={part("type") || "CC"} onValueChange={(v) => setPart("type", v)}>
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
            <Input type="date" required value={part("issueDate")} onChange={(e) => setPart("issueDate", e.target.value)} />
          </Field>
          <Field label={t.vault.documentFields.issuePlace}>
            <Input required value={part("issuePlace")} onChange={(e) => setPart("issuePlace", e.target.value)} />
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
