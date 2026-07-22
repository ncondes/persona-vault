"use client";

import { useCallback, useEffect } from "react";
import { ApiError, getInteraction } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { useLoad } from "@/lib/useLoad";
import { Logo } from "@/components/common/logo";
import { Spinner } from "@/components/common/spinner";
import { ConsentLogin } from "./consent-login";
import { ConsentScreen } from "./consent-screen";

function ExpiredCard() {
  const t = useStrings();
  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 text-center shadow-sm">
      <Logo className="mx-auto" />
      <h1 className="mt-5 text-xl font-semibold tracking-tight">{t.consent.expiredTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.consent.expiredBody}</p>
    </div>
  );
}

// The consent app: loads the interaction and shows sign-in, the consent
// screen, or the expired card. A silent sign-on comes back as a redirect.
export function AuthorizeView({ uid }: { uid: string }) {
  const t = useStrings();
  const { data, loading, error, reload } = useLoad(
    useCallback(() => getInteraction(uid), [uid]),
  );

  useEffect(() => {
    if (data && "redirectTo" in data) {
      window.location.assign(data.redirectTo);
    }
  }, [data]);

  if (error) {
    if (error instanceof ApiError && error.status === 410) return <ExpiredCard />;
    return <p className="text-sm text-destructive">{t.common.somethingWrong}</p>;
  }
  if (loading || !data || "redirectTo" in data) {
    return <Spinner className="size-6" />;
  }
  if (data.prompt === "login") {
    return <ConsentLogin prompt={data} />;
  }
  return <ConsentScreen prompt={data} onDataAdded={() => void reload()} />;
}
