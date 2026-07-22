import { cn } from "@/lib/utils";

// The onboarding progress bar: one segment per step.
export function SegmentedProgress({ total, done }: { total: number; done: number }) {
  return (
    <div className="flex flex-1 gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn("h-1 flex-1 rounded-full", i < done ? "bg-brand" : "bg-zinc-200")}
        />
      ))}
    </div>
  );
}
