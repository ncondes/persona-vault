"use client";

import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedProgress } from "@/components/common/segmented-progress";
import { useStrings } from "@/lib/locale";

interface StepShellProps {
  total: number;
  done: number;
  title: string;
  lead: string;
  optional?: boolean;
  sensitive?: boolean;
  onBack?: () => void;
  onSkip?: () => void;
  submitLabel?: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (event: React.FormEvent) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

// The frame every onboarding step shares: progress on top, form in the
// middle, continue/skip at the bottom.
export function StepShell({
  total,
  done,
  title,
  lead,
  optional,
  sensitive,
  onBack,
  onSkip,
  submitLabel,
  busy,
  error,
  onSubmit,
  children,
  footer,
}: StepShellProps) {
  const t = useStrings();
  return (
    <div className="flex w-full max-w-md flex-col rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
      <div className="mb-7 flex items-center gap-4">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-zinc-400 hover:text-zinc-600">
            <ArrowLeft className="size-5" />
          </button>
        ) : null}
        <SegmentedProgress total={total} done={done} />
      </div>

      <div className="flex items-center gap-2.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {optional ? <Badge variant="secondary">{t.common.optionalBadge}</Badge> : null}
        {sensitive ? (
          <Badge className="bg-sensitive-bg2 text-sensitive border-sensitive-border">
            {t.common.sensitiveBadge}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1.5 text-[15px] text-muted-foreground">{lead}</p>

      <form onSubmit={onSubmit} className="mt-7 flex flex-1 flex-col">
        <div className="space-y-4">{children}</div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <div className="mt-8 flex flex-col gap-2">
          <Button size="xl" type="submit" disabled={busy}>
            {submitLabel ?? t.common.continue}
          </Button>
          {onSkip ? (
            <Button size="xl" type="button" variant="ghost" onClick={onSkip} disabled={busy}>
              {t.common.skip}
            </Button>
          ) : null}
        </div>
      </form>
      {footer ? <div className="mt-5 text-center text-sm">{footer}</div> : null}
    </div>
  );
}
