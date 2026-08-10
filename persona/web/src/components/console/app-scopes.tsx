"use client";

import { useEffect, useState } from "react";
import { useErrorMessage } from "@/components/common/use-error-message";
import { previewPayload, updateApp } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import type { AppView, Catalog, PreviewResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useToast } from "@/components/common/toast";
import { PayloadPreview } from "@/components/console/payload-preview";
import { ScopeSummary } from "@/components/console/scope-summary";
import { ScopePicker } from "@/components/console/scope-picker";
import { FormError } from "@/components/common/form-error";
import {
  diffScopes,
  selectionFrom,
  selectionToScopes,
  type ScopeSelection,
} from "@/lib/scope-selection";

export function AppScopes({
  app,
  catalog,
  onSaved,
}: {
  app: AppView;
  catalog: Catalog;
  onSaved: (next: AppView) => void;
}) {
  const t = useStrings();
  const notify = useToast();
  const saved = selectionFrom(app.allowedScopes, app.requiredScopes);

  const [selection, setSelection] = useState<ScopeSelection>(saved);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useErrorMessage();
  const [confirming, setConfirming] = useState(false);

  const chosen = Object.keys(selection);
  const key = chosen.slice().sort().join(" ");

  // Recompute the payload whenever the selection changes, debounced so working
  // through several toggles does not queue a request per click. `key` is the
  // sorted scope list, so this reruns exactly when the selection changes.
  useEffect(() => {
    if (key === "") return;
    let active = true;
    const handle = window.setTimeout(() => {
      setLoading(true);
      previewPayload(app.purpose, key.split(" "))
        .then(
          (result) => active && setPreview(result),
          () => active && setPreview(null),
        )
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [key, app.purpose]);

  const next = selectionToScopes(selection);
  const { dirty, removes } = diffScopes(app, next);

  // Keeps its own catch on purpose, so ConfirmDialog's never fires for it: this
  // screen has somewhere to put an error, right under the save bar, and a
  // message that stays put beats one that fades after four seconds.
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateApp(app.id, next));
      notify.success(t.console.scopes.saved);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    // The one screen that earns more than the narrow column: the selection and
    // the response have to be visible at the same time.
    // min-w-0 on both children: a grid item defaults to min-width:auto and
    // would otherwise refuse to shrink below its content, scrolling the page
    // sideways on a phone.
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                {t.console.scopes.lead}
              </p>
              <ScopeSummary scopes={catalog.scopes} selection={selection} className="mt-3" />
            </div>
            <ScopePicker
              scopes={catalog.scopes}
              groups={catalog.scopeGroups}
              selection={selection}
              onChange={setSelection}
            />
            <p className="text-sensitive bg-sensitive-bg border-sensitive-border rounded-xl border px-4 py-3 text-[13px] leading-relaxed">
              {t.console.scopes.nameNote}
            </p>
          </CardContent>
        </Card>

        {error ? <FormError>{error}</FormError> : null}

        {dirty ? (
          <div className="bg-background sticky bottom-0 flex flex-wrap items-center gap-3 py-3">
            <Button size="lg" disabled={busy} onClick={() => (removes ? setConfirming(true) : save())}>
              {t.console.form.save}
            </Button>
            <Button variant="outline" size="lg" onClick={() => setSelection(saved)}>
              {t.console.form.cancel}
            </Button>
            {removes ? (
              <p className="text-[13px] text-muted-foreground">{t.console.scopes.narrowWarning}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 xl:sticky xl:top-6">
        <PayloadPreview
          preview={key === "" ? null : preview}
          loading={loading}
          empty={key === ""}
        />
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.console.form.save}
        body={t.console.scopes.narrowWarning}
        confirmLabel={t.console.form.save}
        onConfirm={save}
      />
    </div>
  );
}
