"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { useErrorMessage } from "@/components/common/use-error-message";
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
import { useToast } from "@/components/common/toast";
import { ItemForm } from "@/components/vault/item-form";
import { ConsentFieldCard } from "./consent-field-card";
import { ConsentHeader } from "./consent-header";
import { FormError } from "@/components/common/form-error";

interface ConsentScreenProps {
  prompt: ConsentPrompt;
  onDataAdded: () => void;
}

export function ConsentScreen({ prompt, onDataAdded }: ConsentScreenProps) {
  const t = useStrings();
  const notify = useToast();
  const { data: catalog } = useLoad(getCatalog);
  const [selections, setSelections] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(prompt.fields.map((field) => [field.scope, field.suggestedIds])),
  );
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useErrorMessage();
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
        setError(err);
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

  // Success leaves for the app's own site, so there is nowhere to say it. A
  // failure keeps the person here, where a toast is the only thing on screen
  // that can explain why nothing happened.
  const deny = async () => {
    try {
      const { redirectTo } = await interactionAbort(prompt.uid);
      window.location.assign(redirectTo);
    } catch (err) {
      notify.failure(err);
    }
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

      {/* Two separate claims, deliberately not merged into one badge. The first
          is about the person's own control over the data; the second is about
          the app, and it is the only one Persona actually checked. An app that
          has proved nothing says so, in words rather than by the absence of a
          tick — a missing badge is not something anyone notices. */}
      <div className="mx-auto mt-4 flex w-fit flex-col items-center gap-1.5">
        {trivial ? (
          <p className="text-center text-sm text-muted-foreground">{t.consent.trivialNote}</p>
        ) : (
          <div className="flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600">
            <ShieldCheck className="size-3.5 text-zinc-400" />
            {t.consent.dataNote}
          </div>
        )}

        {prompt.client.verifiedDomain ? (
          <div className="flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600">
            <BadgeCheck className="text-brand size-3.5" />
            {t.consent.verifiedDomain(prompt.client.verifiedDomain)}
          </div>
        ) : (
          <div className="border-sensitive/40 bg-sensitive/10 text-sensitive flex w-fit items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs">
            <ShieldAlert className="size-3.5" />
            {t.consent.unverified}
          </div>
        )}
      </div>

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

      {error ? <FormError className="mt-3">{error}</FormError> : null}

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
