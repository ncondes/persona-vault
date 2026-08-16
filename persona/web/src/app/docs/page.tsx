"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import {
  DATA_SCOPES,
  DOCS_CODE,
  NEXT_LINKS,
  PURPOSE_VARIANTS,
  getDocsContent,
} from "@/lib/docs-content";
import { useLocale, useStrings } from "@/lib/locale";
import { CodeBlock, type Snippet } from "@/components/console/code-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DocsHeader } from "@/components/docs/docs-header";
import { TableOfContents } from "@/components/docs/table-of-contents";

function Section({
  id,
  step,
  title,
  children,
}: {
  id: string;
  step?: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3">
        {step ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-tint text-[13px] font-semibold text-brand">
            {step}
          </span>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

function Paragraphs({ body }: { body: readonly string[] }) {
  return (
    <>
      {body.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </>
  );
}

const one = (id: string, label: string, note: string, code: string): Snippet[] => [
  { id, label, note, code },
];

export default function DocsPage() {
  const { locale } = useLocale();
  const t = useStrings();
  const d = getDocsContent(locale);

  const toc = [
    { id: "what", label: d.intro.nav },
    { id: "flow", label: d.flow.nav },
    { id: "register", label: d.register.nav },
    { id: "authorize", label: d.authorize.nav },
    { id: "callback", label: d.callback.nav },
    { id: "userinfo", label: d.userinfo.nav },
    { id: "react", label: d.react.nav },
    { id: "scopes", label: d.scopes.nav },
    { id: "gotchas", label: d.gotchas.nav },
    { id: "next", label: d.next.nav },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <DocsHeader />

      <main className="mx-auto max-w-6xl px-5 py-10 lg:py-14">
        <div className="lg:grid lg:grid-cols-[1fr_15rem] lg:gap-12">
          <div className="min-w-0 max-w-3xl">
            {/* Hero */}
            <p className="text-[11px] font-semibold tracking-wide text-brand uppercase">
              {d.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {d.title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
              {d.tagline}
            </p>
            <div className="mt-5">
              <Button asChild size="lg">
                <Link href="/console/new">{t.console.register}</Link>
              </Button>
            </div>

            <div className="mt-12 space-y-12">
              {/* What is Persona */}
              <Section id="what" title={d.intro.heading}>
                <Paragraphs body={d.intro.body} />
                <div className="rounded-xl bg-brand-tint/60 p-4 text-foreground/80 ring-1 ring-brand/15">
                  {d.intro.variant}
                </div>
              </Section>

              {/* How the flow works */}
              <Section id="flow" title={d.flow.heading}>
                <p>{d.flow.lead}</p>
                <ol className="grid gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-5">
                  {d.flow.steps.map((s, i) => (
                    <li key={i} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                      <span className="font-mono text-[11px] font-semibold text-brand">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="mt-1 text-sm font-semibold">{s.title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                        {s.body}
                      </p>
                    </li>
                  ))}
                </ol>
              </Section>

              {/* 1. Register */}
              <Section id="register" step={1} title={d.register.heading}>
                <Paragraphs body={d.register.body} />
                <CodeBlock snippets={one("env", d.register.envLabel, d.register.envNote, DOCS_CODE.env)} />
              </Section>

              {/* 2. Redirect */}
              <Section id="authorize" step={2} title={d.authorize.heading}>
                <Paragraphs body={d.authorize.body} />
                <CodeBlock
                  snippets={one("authorize", d.authorize.label, d.authorize.note, DOCS_CODE.authorize)}
                />
              </Section>

              {/* 3. Callback */}
              <Section id="callback" step={3} title={d.callback.heading}>
                <Paragraphs body={d.callback.body} />
                <CodeBlock
                  snippets={one("callback", d.callback.label, d.callback.note, DOCS_CODE.callback)}
                />
              </Section>

              {/* 4. Userinfo */}
              <Section id="userinfo" step={4} title={d.userinfo.heading}>
                <Paragraphs body={d.userinfo.body} />
                <CodeBlock
                  snippets={one("userinfo", d.userinfo.label, d.userinfo.note, DOCS_CODE.userinfo)}
                />
              </Section>

              {/* React */}
              <Section id="react" title={d.react.heading}>
                <Paragraphs body={d.react.body} />
                <CodeBlock snippets={one("react", d.react.label, d.react.note, DOCS_CODE.react)} />
              </Section>

              {/* Scopes & purposes */}
              <Section id="scopes" title={d.scopes.heading}>
                <Paragraphs body={d.scopes.body} />

                <div className="pt-1">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {d.scopes.dataScopesHeading}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {DATA_SCOPES.map((scope) => (
                      <Badge key={scope} variant="secondary" className="font-mono">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-[13px] text-muted-foreground">{d.scopes.dataScopesNote}</p>
                </div>

                <div className="pt-2">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {d.scopes.purposesHeading}
                  </p>
                  <Card className="mt-2.5 py-0">
                    <CardContent className="divide-y divide-zinc-100 px-0">
                      {PURPOSE_VARIANTS.map(({ purpose, variant }) => (
                        <div
                          key={purpose}
                          className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                        >
                          <span className="font-medium">
                            {t.console.purposes[purpose] ?? purpose}
                          </span>
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <ArrowRight className="size-3.5 text-zinc-300" />
                            {d.scopes.variants[variant] ?? variant}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <p>
                  <Link
                    href="/console/scopes"
                    className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                  >
                    {d.scopes.catalogue}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </p>
              </Section>

              {/* Gotchas */}
              <Section id="gotchas" title={d.gotchas.heading}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {d.gotchas.items.map((item, i) => (
                    <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Next steps */}
              <Section id="next" title={d.next.heading}>
                <div className="grid gap-3 sm:grid-cols-3">
                  {NEXT_LINKS.map((link, i) => {
                    const item = d.next.items[i];
                    const inner = (
                      <>
                        <span className="flex items-center gap-1 text-sm font-semibold">
                          {item.label}
                          {link.external ? (
                            <ArrowUpRight className="size-3.5 text-zinc-400" />
                          ) : (
                            <ArrowRight className="size-3.5 text-zinc-400" />
                          )}
                        </span>
                        <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                          {item.note}
                        </span>
                      </>
                    );
                    const className =
                      "block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50";
                    return link.external ? (
                      <a key={i} href={link.href} target="_blank" rel="noreferrer" className={className}>
                        {inner}
                      </a>
                    ) : (
                      <Link key={i} href={link.href} className={className}>
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </Section>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <TableOfContents items={toc} label={d.onThisPage} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
