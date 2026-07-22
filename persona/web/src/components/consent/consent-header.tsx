import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { initialsOf } from "@/components/shell/user-card";
import type { InteractionClient } from "@/lib/types";

// Client mark → Persona mark, then the client name.
export function ConsentHeader({ client, subtitle }: { client: InteractionClient; subtitle?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <div className="flex size-[42px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-sm font-semibold text-zinc-700">
          {initialsOf(client.name ?? client.id)}
        </div>
        <ArrowRight className="size-4 text-zinc-300" />
        <Logo />
      </div>
      <h1 className="mt-3.5 text-xl font-semibold tracking-tight">{client.name ?? client.id}</h1>
      {subtitle ? <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div> : null}
    </div>
  );
}
