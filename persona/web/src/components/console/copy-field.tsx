"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStrings } from "@/lib/locale";

// A read-only value with a copy button. `value` is what gets copied, which is
// not always what is shown — a masked secret shows dots and copies nothing.
export function CopyField({
  value,
  display,
  copyable = true,
  action,
}: {
  value: string;
  display?: string;
  copyable?: boolean;
  action?: React.ReactNode;
}) {
  const t = useStrings();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex gap-2">
      <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl bg-zinc-50 px-3.5 ring-1 ring-zinc-200">
        <span className="truncate font-mono text-[13px]">{display ?? value}</span>
      </div>
      {copyable ? (
        <Button type="button" variant="outline" className="h-11 shrink-0 px-4" onClick={copy}>
          {copied ? t.console.credentials.copied : t.console.credentials.copy}
        </Button>
      ) : null}
      {action}
    </div>
  );
}
