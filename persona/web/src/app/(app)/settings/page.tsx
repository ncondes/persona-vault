"use client";

import { useCallback, useState } from "react";
import { ChevronRight, Download } from "lucide-react";
import { deleteAccount, getMe, getSettings, logout, updateSettings } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { useLoad } from "@/lib/useLoad";
import type { Settings } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Spinner } from "@/components/common/spinner";
import { initialsOf } from "@/components/shell/user-card";

export default function SettingsPage() {
  const t = useStrings();
  const me = useLoad(useCallback(() => getMe(), []));
  const settings = useLoad(useCallback(() => getSettings(), []));
  const [local, setLocal] = useState<Settings | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const current = local ?? settings.data;

  const toggle = (key: keyof Settings, value: boolean) => {
    if (!current) return;
    const next = { ...current, [key]: value };
    setLocal(next); // optimistic; the PUT confirms it
    void updateSettings({ [key]: value });
  };

  const signOut = async () => {
    await logout();
    window.location.assign("/login");
  };

  if (settings.loading || me.loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">{t.settings.title}</h1>

      <Card className="mt-0 lg:mt-5">
        <CardContent className="flex items-center gap-3.5">
          <div className="bg-brand flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">
            {me.data ? initialsOf(me.data.email) : "…"}
          </div>
          <p className="truncate text-sm font-medium">{me.data?.email}</p>
        </CardContent>
      </Card>

      <p className="mt-6 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {t.settings.privacy}
      </p>
      <Card className="mt-2.5">
        <CardContent className="divide-y divide-zinc-100">
          <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <span className="text-[15px]">{t.settings.confirmSensitive}</span>
            <Switch
              checked={current?.confirmSensitive ?? true}
              onCheckedChange={(v) => toggle("confirmSensitive", v)}
            />
          </div>
          <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <span className="text-[15px]">{t.settings.notifyAccess}</span>
            <Switch
              checked={current?.notifyAccess ?? false}
              onCheckedChange={(v) => toggle("notifyAccess", v)}
            />
          </div>
          <a
            href="/api/export"
            download="persona-export.json"
            className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:text-brand"
          >
            <span className="text-[15px]">{t.settings.downloadData}</span>
            <Download className="size-4 text-zinc-400" />
          </a>
        </CardContent>
      </Card>

      <p className="mt-6 text-[11px] font-semibold tracking-wide text-destructive uppercase">
        {t.settings.dangerZone}
      </p>
      <Card className="border-danger-border bg-danger-bg mt-2.5">
        <CardContent className="divide-y divide-danger-border">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-between py-3 text-left first:pt-0 last:pb-0"
          >
            <span className="text-[15px]">{t.settings.logout}</span>
            <ChevronRight className="size-4 text-zinc-400" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex w-full items-center justify-between py-3 text-left first:pt-0 last:pb-0"
          >
            <span>
              <span className="block text-[15px] font-medium text-destructive">
                {t.settings.deleteAccount}
              </span>
              <span className="text-xs text-destructive/60">{t.settings.deleteWarning}</span>
            </span>
            <ChevronRight className="size-4 text-destructive/40" />
          </button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t.settings.deleteAccount}
        body={t.settings.deleteConfirm}
        confirmLabel={t.common.delete}
        onConfirm={async () => {
          await deleteAccount();
          window.location.assign("/");
        }}
      />
    </div>
  );
}
