import { ShieldAlert } from "lucide-react";

export function Masthead({ action }: { action?: React.ReactNode }) {
  return (
    <header className="border-line hazard border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="border-broken/40 bg-broken-soft text-broken flex size-9 items-center justify-center rounded-[3px] border">
            <ShieldAlert className="size-[18px]" aria-hidden />
          </span>
          <div>
            <p className="font-display text-[15px] leading-none font-700 tracking-tight">Probe</p>
            <p className="font-data text-ink-faint mt-1 text-[11px] leading-none">
              adversarial relying party
            </p>
          </div>
        </div>
        {action}
      </div>
    </header>
  );
}

export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line bg-panel overflow-hidden rounded-[4px] border">
      <div className="border-line bg-panel-2 flex items-baseline justify-between border-b px-4 py-2.5">
        <h2 className="font-data text-ink-soft text-[11px] tracking-wide uppercase">{title}</h2>
        {note ? <span className="font-data text-ink-faint text-[11px]">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

// Green only when the defence demonstrably held. Amber for a run that proved
// nothing — it must never be mistaken for a pass.
export function Verdict({ state }: { state: "held" | "broken" | "unknown" }) {
  const label = { held: "BLOCKED", broken: "GOT THROUGH", unknown: "INCONCLUSIVE" }[state];
  const styles = {
    held: "border-held/40 bg-held-soft text-held",
    broken: "border-broken/50 bg-broken-soft text-broken",
    unknown: "border-unknown/40 bg-unknown-soft text-unknown",
  }[state];

  return (
    <span
      className={`font-data inline-flex shrink-0 items-center rounded-[3px] border px-2 py-1 text-[10px] font-700 tracking-wider ${styles}`}
    >
      {label}
    </span>
  );
}
