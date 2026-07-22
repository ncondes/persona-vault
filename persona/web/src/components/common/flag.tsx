import { cn } from "@/lib/utils";

// A country flag from the flagcdn.com CDN (flagpedia). `code` is an ISO
// 3166-1 alpha-2 code like "CO"; we request the width-based asset (w40, and
// w80 for retina) and show it as a small fixed rectangle.
export function Flag({ code, className }: { code: string; className?: string }) {
  const c = code.toLowerCase();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${c}.png`}
      srcSet={`https://flagcdn.com/w80/${c}.png 2x`}
      alt=""
      className={cn("h-3.5 w-5 shrink-0 rounded-[2px] object-cover", className)}
    />
  );
}
