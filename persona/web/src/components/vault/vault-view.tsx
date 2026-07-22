"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCatalog, getConnections, getVault } from "@/lib/api";
import { SECTIONS } from "@/lib/sections";
import { t } from "@/lib/strings";
import { useLoad } from "@/lib/useLoad";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/common/spinner";
import { FieldGroupCard } from "./field-group-card";

export function VaultView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? SECTIONS[0].id;

  const vault = useLoad(useCallback(() => getVault(), []));
  const catalog = useLoad(useCallback(() => getCatalog(), []));
  const connections = useLoad(useCallback(() => getConnections(), []));

  if (vault.loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (vault.error || !vault.data) {
    return <p className="py-10 text-sm text-destructive">{t.common.somethingWrong}</p>;
  }

  const items = vault.data.items;
  const section = SECTIONS.find((s) => s.id === tab) ?? SECTIONS[0];

  return (
    <div className="max-w-2xl">
      <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">{t.vault.title}</h1>

      <Tabs value={section.id} onValueChange={(id) => router.replace(`/vault?tab=${id}`)} className="mt-0 lg:mt-5">
        <TabsList className="w-full justify-start overflow-x-auto">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {t.vault.sections[s.id]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-5 flex flex-col gap-4">
        {section.kinds.map((kind) => (
          <FieldGroupCard
            key={kind}
            kind={kind}
            items={items.filter((item) => item.kind === kind)}
            catalog={catalog.data}
            connections={connections.data ?? []}
            onChanged={() => {
              void vault.reload();
              void connections.reload();
            }}
          />
        ))}
      </div>
    </div>
  );
}
