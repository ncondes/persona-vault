"use client";

import { useMemo, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { ApiError, getCatalog, interactionAbort, interactionDecision } from "@/lib/api";
import {
  buildDecision,
  isTrivial,
  missingRequired,
  needsConfirmation,
  partitionFields,
  sensitiveSharedCount,
} from "@/lib/consent-decision";
import { useStrings } from "@/lib/locale";
import { useLoad } from "@/lib/useLoad";
import type { ConsentPrompt, InteractionField } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ItemForm } from "@/components/vault/item-form";
import { ConsentFieldCard } from "./consent-field-card";
import { ConsentHeader } from "./consent-header";

interface ConsentScreenProps {
  prompt: ConsentPrompt;
  onDataAdded: () => void;
}

export function ConsentScreen({ prompt, onDataAdded }: ConsentScreenProps) {
  const t = useStrings();
  const { data: catalog } = useLoad(getCatalog);
  const [selections, setSelections] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(prompt.fields.map((field) => [field.scope, field.suggestedIds])),
  );
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { normal, sensitive } = useMemo(() => partitionFields(prompt.fields), [prompt.fields]);

  const blocking = missingRequired(prompt.fields);
  const trivial = isTrivial(prompt.fields);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const decision = buildDecision(prompt.fields, selections, excluded);
      const { redirectTo } = await interactionDecision(prompt.uid, decision);
      window.location.assign(redirectTo);
    } catch (err) {
      if (err instanceof ApiError && err.code === "MISSING_FIELDS") {
        onDataAdded(); // refresh the details; the missing cards will show
      } else {
        setError(err instanceof ApiError ? err.message : t.common.somethingWrong);
      }
      setBusy(false);
    }
  };

  const approve = () => {
    if (needsConfirmation(prompt, excluded)) {
      setConfirming(true);
    } else {
      void submit();
    }
  };

  const deny = async () => {
    const { redirectTo } = await interactionAbort(prompt.uid);
    window.location.assign(redirectTo);
  };

  const renderField = (field: InteractionField) => {
    if (field.missing && field.required) {
      return (
        <div
          key={field.scope}
          className="rounded-2xl border-[1.5px] border-dashed border-sensitive-border bg-sensitive-bg p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-medium">{t.scopes[field.scope] ?? field.scope}</span>
            <span className="bg-sensitive-bg2 text-sensitive border-sensitive-border rounded-full border px-2 py-0.5 text-[10px] font-semibold">
              {t.consent.missingBadge}
            </span>
          </div>
          <ItemForm
            kind={field.kind}
            catalog={catalog}
            submitLabel={t.consent.addAndSave}
            onSaved={onDataAdded}
          />
          <p className="text-sensitive mt-2 text-xs leading-snug">{t.consent.missingNote}</p>
        </div>
      );
    }
    if (field.missing) {
      return (
        <div key={field.scope} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <span className="text-sm font-medium text-zinc-500">
            {t.scopes[field.scope] ?? field.scope}
          </span>
          <p className="mt-1 text-sm text-zinc-400">{t.consent.optionalMissing}</p>
        </div>
      );
    }
    return (
      <ConsentFieldCard
        key={field.scope}
        field={field}
        selected={selections[field.scope] ?? []}
        enabled={!excluded.has(field.scope)}
        onSelect={(ids) => setSelections((s) => ({ ...s, [field.scope]: ids }))}
        onToggle={(enabled) =>
          setExcluded((old) => {
            const next = new Set(old);
            if (enabled) next.delete(field.scope);
            else next.add(field.scope);
            return next;
          })
        }
      />
    );
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <ConsentHeader
        client={prompt.client}
        subtitle={
          <>
            {t.consent.wantsAccess}{" "}
            <b className="text-foreground">{t.consent.itemCount(prompt.fields.length)}</b>
          </>
        }
      />

      {trivial ? (
        <p className="mt-5 text-center text-sm text-muted-foreground">{t.consent.trivialNote}</p>
      ) : (
        <div className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600">
          <BadgeCheck className="text-brand size-3.5" />
          {t.consent.verified}
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {normal.map(renderField)}
        {sensitive.length > 0 ? (
          <div className="flex items-center gap-2.5 py-1.5">
            <div className="h-px flex-1 bg-zinc-100" />
            <span className="text-sensitive text-[11px] font-semibold tracking-wide">
              {t.consent.sensitiveDivider}
            </span>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>
        ) : null}
        {sensitive.map(renderField)}
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-6">
        <Button
          size="xl"
          className="w-full"
          disabled={busy || blocking.length > 0}
          onClick={approve}
        >
          {blocking.length > 0 ? t.consent.approveMissing : t.consent.approve}
        </Button>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <button type="button" className="hover:text-foreground hover:underline" onClick={deny}>
            {t.consent.dontShare}
          </button>
          <span>·</span>
          <span>{t.consent.footerNote}</span>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.consent.confirmTitle}
        body={t.consent.confirmBody(sensitiveSharedCount(prompt.fields, excluded))}
        confirmLabel={t.consent.approve}
        onConfirm={submit}
      />
    </div>
  );
}
