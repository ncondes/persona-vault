"use client";

import { useStrings } from "@/lib/locale";
import { toPayloadLines } from "@/lib/payload-lines";
import type { PreviewResult } from "@/lib/types";
import { Spinner } from "@/components/common/spinner";

export function PayloadPreview({
  preview,
  loading,
  empty,
}: {
  preview: PreviewResult | null;
  loading: boolean;
  empty: boolean;
}) {
  const t = useStrings();

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="px-4 pt-4">
        <h3 className="text-[13px] font-semibold">{t.console.payload.title}</h3>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{t.console.payload.lead}</p>
      </div>
      <div className="p-4">
        {empty ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-8 text-center text-[13px] text-muted-foreground ring-1 ring-zinc-200/70">
            {t.console.payload.emptyBody}
          </p>
        ) : loading && !preview ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : preview ? (
          <div className="overflow-x-auto rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
            <pre className="font-mono text-[12.5px] leading-relaxed">
              {toPayloadLines(preview, t.console.payload.noData, t.console.payload.alwaysPresent).map(
                (line, index) => (
                  <div key={index} className="whitespace-pre">
                    <span className={line.muted ? "text-zinc-400" : undefined}>{line.text}</span>
                    {line.note ? (
                      <span className="ml-3 text-[11.5px] text-zinc-400 italic">
                        · {line.note}
                      </span>
                    ) : null}
                  </div>
                ),
              )}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
