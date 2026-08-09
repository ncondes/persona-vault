"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStrings } from "@/lib/locale";
import { cn } from "@/lib/utils";

export interface Snippet {
  id: string;
  label: string;
  note: string;
  code: string;
}

// Tabbed integration snippets. The code is real and runnable rather than a
// prose description of a request, so copying it is the same as understanding it.
export function CodeBlock({ snippets }: { snippets: Snippet[] }) {
  const t = useStrings();
  const [active, setActive] = useState(snippets[0]?.id);
  const [copied, setCopied] = useState(false);

  const current = snippets.find((s) => s.id === active) ?? snippets[0];
  if (!current) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(current.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="flex items-center gap-1 overflow-x-auto p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {snippets.map((snippet) => (
          <button
            key={snippet.id}
            type="button"
            onClick={() => setActive(snippet.id)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              snippet.id === current.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {snippet.label}
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto shrink-0"
          onClick={copy}
        >
          {copied ? t.console.credentials.copied : t.console.credentials.copy}
        </Button>
      </div>
      <div className="px-3.5 pb-3.5">
        <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
          <code className="font-mono text-[12.5px] leading-relaxed whitespace-pre">
            {current.code}
          </code>
        </pre>
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">{current.note}</p>
      </div>
    </div>
  );
}
