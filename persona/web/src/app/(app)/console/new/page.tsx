"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError, createApp, getCatalog } from "@/lib/api";
import { errorMessage, fieldMessages } from "@/lib/error-message";
import { useStrings } from "@/lib/locale";
import { useLoad } from "@/lib/useLoad";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { Spinner } from "@/components/common/spinner";
import { useToast } from "@/components/common/toast";
import {
  AppIdentityFields,
  RedirectUriFields,
  type AppDraft,
} from "@/components/console/app-form";
import { ScopePicker } from "@/components/console/scope-picker";
import { selectionToScopes, type ScopeSelection } from "@/lib/scope-selection";
import { SecretDialog } from "@/components/console/secret-dialog";
import { ScopeSummary } from "@/components/console/scope-summary";
import { FormError } from "@/components/common/form-error";

// The fields the form draws a control for, and so the ones that can show their
// own error. Keep in step with the JSX below.
const INLINE_FIELDS = ["name", "description", "purpose", "redirectUris"];

export default function NewAppPage() {
  const t = useStrings();
  const notify = useToast();
  const router = useRouter();
  const catalog = useLoad(useCallback(() => getCatalog(), []));

  const [draft, setDraft] = useState<AppDraft>({
    name: "",
    description: "",
    purpose: "other",
    accent: "teal",
    redirectUris: [""],
  });
  const [selection, setSelection] = useState<ScopeSelection>({});
  // The failure, not the sentences about it: the sentences depend on the
  // language, and it can change while they are on screen.
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  if (catalog.loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (catalog.error || !catalog.data) {
    return <p className="py-10 text-sm text-destructive">{t.common.somethingWrong}</p>;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      const app = await createApp({
        name: draft.name,
        description: draft.description || null,
        purpose: draft.purpose,
        accent: draft.accent,
        redirectUris: draft.redirectUris.map((uri) => uri.trim()).filter(Boolean),
        ...selectionToScopes(selection),
      });
      setCreatedId(app.id);
      setSecret(app.secret);
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  // Per field where the server named one, and on the name field otherwise, so a
  // failure always has somewhere visible to land.
  const named = failure instanceof ApiError ? fieldMessages(t, failure.fields) : {};
  const errors =
    Object.keys(named).length > 0
      ? named
      : failure
        ? { name: errorMessage(t, failure) }
        : {};

  // Fields with a home on screen say it themselves. What is left — a scope
  // problem, say, which the picker has no room for — goes above the buttons.
  const firstError = Object.entries(errors).find(
    ([field]) => !INLINE_FIELDS.includes(field.split(".")[0]),
  )?.[1];

  return (
    <div className="max-w-2xl">
      <Link
        href="/console"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {t.console.back}
      </Link>

      <PageHeader title={t.console.form.title} lead={t.console.form.lead} />

      <form onSubmit={submit} className="mt-6 flex flex-col gap-8">
        <section>
          <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t.console.form.identity}
          </p>
          <Card>
            <CardContent>
              <AppIdentityFields
                draft={draft}
                purposes={catalog.data.purposes}
                errors={errors}
                onChange={setDraft}
              />
            </CardContent>
          </Card>
        </section>

        <section>
          <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t.console.form.redirect}
          </p>
          <Card>
            <CardContent>
              <RedirectUriFields
                uris={draft.redirectUris}
                errors={errors}
                onChange={(redirectUris) => setDraft({ ...draft, redirectUris })}
              />
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t.console.scopes.heading}
            </p>
            <Link href="/console/scopes" className="text-[13px] text-brand hover:underline">
              {t.console.scopes.catalogLink}
            </Link>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  {t.console.scopes.lead}
                </p>
                <ScopeSummary
                  scopes={catalog.data.scopes}
                  selection={selection}
                  className="mt-3"
                />
              </div>
              <ScopePicker
                scopes={catalog.data.scopes}
                groups={catalog.data.scopeGroups}
                selection={selection}
                onChange={setSelection}
              />
              <p className="text-sensitive bg-sensitive-bg border-sensitive-border rounded-xl border px-4 py-3 text-[13px] leading-relaxed">
                {t.console.scopes.sensitiveNote}
              </p>
            </CardContent>
          </Card>
        </section>

        {firstError ? <FormError>{firstError}</FormError> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="xl" disabled={busy}>
            {t.console.form.create}
          </Button>
          <Button type="button" variant="outline" size="xl" asChild>
            <Link href="/console">{t.console.form.cancel}</Link>
          </Button>
          <p className="text-[13px] text-muted-foreground">{t.console.form.createHint}</p>
        </div>
      </form>

      {/* Said on the way out rather than on success: while the dialog is open
          it is already the news, and router.push is soft, so the toast rides
          across to the detail page. */}
      <SecretDialog
        secret={secret}
        onClose={() => {
          setSecret(null);
          notify.success(t.console.appCreated);
          if (createdId) router.push(`/console/${createdId}`);
        }}
      />
    </div>
  );
}
