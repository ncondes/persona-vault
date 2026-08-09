"use client";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useStrings } from "@/lib/locale";
import type { ScopeLevel, ScopeSelection } from "@/lib/scope-selection";
import type { ScopeGroup, ScopeMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

function LevelToggle({
  level,
  onChange,
}: {
  level: ScopeLevel;
  onChange: (level: ScopeLevel) => void;
}) {
  const t = useStrings();
  const options: Array<[ScopeLevel, string]> = [
    ["optional", t.console.scopes.optional],
    ["required", t.console.scopes.required],
  ];

  return (
    <div className="inline-flex shrink-0 rounded-lg bg-muted p-0.5">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onChange(value);
          }}
          className={cn(
            "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
            level === value
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ScopeRow({
  meta,
  level,
  onToggle,
  onLevel,
}: {
  meta: ScopeMeta;
  level: ScopeLevel | undefined;
  onToggle: () => void;
  onLevel: (level: ScopeLevel) => void;
}) {
  const t = useStrings();
  const on = level !== undefined;

  return (
    <div
      className={cn(
        "rounded-xl px-3.5 py-3 transition-colors",
        on && meta.sensitive && "bg-sensitive-bg ring-1 ring-sensitive-border",
        on && !meta.sensitive && "bg-muted/60",
      )}
    >
      {/* Stacks below `sm`: the level control needs the full width on a phone. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={on}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-medium">{t.scopes[meta.scope] ?? meta.scope}</span>
            {meta.sensitive ? (
              <Badge className="bg-sensitive-bg2 text-sensitive border-transparent">
                {t.console.scopes.sensitive}
              </Badge>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
            {t.console.scopes.desc[meta.scope] ?? ""}
          </span>
          <span className="mt-1 block font-mono text-[11.5px] text-zinc-400">{meta.scope}</span>
        </button>

        {/* An enabled row carries the level control too, which needs its own
            line on a phone. A switch on its own stays inline. */}
        <div
          className={cn(
            "flex items-center gap-3",
            on ? "w-full justify-end sm:ml-auto sm:w-auto" : "ml-auto",
          )}
        >
          {on ? <LevelToggle level={level} onChange={onLevel} /> : null}
          <Switch checked={on} onCheckedChange={onToggle} aria-label={meta.label} />
        </div>
      </div>
    </div>
  );
}

export function ScopePicker({
  scopes,
  groups,
  selection,
  onChange,
}: {
  scopes: ScopeMeta[];
  groups: ScopeGroup[];
  selection: ScopeSelection;
  onChange: (next: ScopeSelection) => void;
}) {
  const t = useStrings();

  const toggle = (scope: string) => {
    const next = { ...selection };
    if (next[scope]) delete next[scope];
    else next[scope] = "optional";
    onChange(next);
  };

  const setLevel = (scope: string, level: ScopeLevel) => {
    if (!selection[scope]) return;
    onChange({ ...selection, [scope]: level });
  };

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const rows = scopes.filter((meta) => meta.group === group);
        if (rows.length === 0) return null;
        return (
          <section key={group}>
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-1">
              <h3 className="text-[13px] font-semibold">{t.console.scopes.groups[group]}</h3>
              <p className="text-[12.5px] text-muted-foreground">
                {t.console.scopes.groupHints[group]}
              </p>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              {rows.map((meta) => (
                <ScopeRow
                  key={meta.scope}
                  meta={meta}
                  level={selection[meta.scope]}
                  onToggle={() => toggle(meta.scope)}
                  onLevel={(level) => setLevel(meta.scope, level)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
