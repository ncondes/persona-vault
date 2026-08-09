"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteApp, rotateAppSecret, updateApp } from "@/lib/api";
import { integrationSnippets } from "@/lib/snippets";
import { useStrings } from "@/lib/locale";
import type { AppView, Catalog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useToast } from "@/components/common/toast";
import { CodeBlock } from "@/components/console/code-block";
import { CopyField } from "@/components/console/copy-field";
import { SecretDialog } from "@/components/console/secret-dialog";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function AppOverview({
  app,
  catalog,
  onChanged,
}: {
  app: AppView;
  catalog: Catalog;
  onChanged: (next: AppView) => void;
}) {
  const t = useStrings();
  const notify = useToast();
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rotate = async () => {
    const rotated = await rotateAppSecret(app.id);
    onChanged(rotated);
    setSecret(rotated.secret);
  };

  const remove = async () => {
    await deleteApp(app.id);
    notify.success(t.console.appDeleted);
    router.push("/console");
  };

  const toggleStatus = async (active: boolean) => {
    onChanged(await updateApp(app.id, { status: active ? "active" : "disabled" }));
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionLabel>{t.console.credentials.title}</SectionLabel>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[13px] font-medium">{t.console.credentials.clientId}</p>
              <CopyField value={app.id} />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium">{t.console.credentials.clientSecret}</p>
              <CopyField
                value=""
                display={`••••••••••${app.secretLastFour}`}
                copyable={false}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 px-4"
                    onClick={() => setRotating(true)}
                  >
                    {t.console.credentials.rotate}
                  </Button>
                }
              />
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                {t.console.credentials.secretHint}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionLabel>{t.console.integration.title}</SectionLabel>
        <CodeBlock snippets={integrationSnippets(app, catalog.issuer, t)} />
      </section>

      <section>
        <SectionLabel>{t.console.settings.title}</SectionLabel>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[13px] font-medium">{t.console.form.redirectUris}</p>
              <div className="flex flex-col gap-2">
                {app.redirectUris.map((uri) => (
                  <div
                    key={uri}
                    className="overflow-x-auto rounded-xl bg-zinc-50 px-3.5 py-3 ring-1 ring-zinc-200"
                  >
                    <span className="font-mono text-[12.5px] whitespace-nowrap">{uri}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 border-t border-zinc-100 pt-4">
              <div className="flex-1">
                <p className="text-[14.5px] font-medium">{t.console.settings.active}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {t.console.settings.activeHint}
                </p>
              </div>
              <Switch
                checked={app.status === "active"}
                onCheckedChange={(value) => void toggleStatus(value)}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-danger-border bg-danger-bg">
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-destructive text-[14.5px] font-medium">
              {t.console.settings.danger}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {t.console.settings.dangerBody}
            </p>
          </div>
          <Button variant="destructive" onClick={() => setDeleting(true)}>
            {t.console.settings.delete}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={rotating}
        onOpenChange={setRotating}
        title={t.console.credentials.rotate}
        body={t.console.credentials.rotateConfirm}
        confirmLabel={t.console.credentials.rotate}
        onConfirm={rotate}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t.console.settings.danger}
        body={t.console.settings.deleteConfirm}
        confirmLabel={t.console.settings.delete}
        onConfirm={remove}
      />
      {/* Told on the way out, not on success: the dialog itself is the news
          while it is open, and a toast under it would just repeat it. */}
      <SecretDialog
        secret={secret}
        onClose={() => {
          setSecret(null);
          notify.success(t.console.secretRotated);
        }}
      />
    </div>
  );
}
