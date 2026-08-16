import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ATTACKS } from "@/lib/attacks";
import { SESSION_COOKIE } from "@/lib/persona";
import { Masthead, Panel } from "@/components/shell";

const ERRORS: Record<string, string> = {
  access_denied: "Consent was declined, so nothing was shared. The unauthenticated checks still run.",
  invalid_callback: "That callback could not be verified. Start again.",
  token_exchange_failed: "Could not reach Persona. Is the provider running on :4400?",
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const store = await cookies();
  if (store.has(SESSION_COOKIE)) redirect("/console");

  const { error } = await searchParams;

  return (
    <>
      <Masthead />

      <main className="mx-auto max-w-5xl space-y-5 px-5 py-9">
        <div className="max-w-[62ch]">
          <h1 className="font-display text-[27px] leading-tight font-700 tracking-tight">
            A registered client that misbehaves on purpose
          </h1>
          <p className="text-ink-soft mt-3 text-[15px] leading-relaxed">
            The clinic, the forum and the store show what Persona does when everyone behaves. Probe
            is the fourth app, and it is hostile. It registered honestly — a social app asking for a
            name and a handle — and then goes after health data, other people&rsquo;s vaults, and
            tokens it should not be able to use.
          </p>
          <p className="text-ink-soft mt-3 text-[15px] leading-relaxed">
            Everything below runs over HTTP against the real provider. Nothing is stubbed, and
            nothing is scored by reading Persona&rsquo;s source. A red row is a real finding.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="border-broken/40 bg-broken-soft text-broken rounded-[3px] border px-4 py-3 text-[14px]"
          >
            {ERRORS[error] ?? "Something went wrong. Try again."}
          </p>
        ) : null}

        <Panel title="What it tries" note={`${ATTACKS.length} checks`}>
          <ul className="divide-line divide-y">
            {ATTACKS.map((attack, index) => (
              <li key={attack.id} className="flex gap-4 px-4 py-3">
                <span className="font-data text-ink-faint pt-0.5 text-[11px] tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">{attack.title}</p>
                  <p className="font-data text-ink-faint mt-1 text-[11px]">{attack.threat}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="border-line bg-panel flex flex-wrap items-center justify-between gap-4 rounded-[4px] border px-5 py-4">
          <p className="text-ink-soft max-w-[52ch] text-[14px] leading-relaxed">
            Six checks need no session and run immediately. The rest need a live access token, so
            Probe has to connect the way any client would — through the consent screen, with the
            person&rsquo;s approval.
          </p>
          <a
            href="/connect"
            className="border-line bg-panel-2 font-display inline-flex h-10 shrink-0 items-center rounded-[3px] border px-5 text-[14px] font-700 transition-colors hover:bg-[#2b303a]"
          >
            Connect with Persona
          </a>
        </div>

        <p className="font-data text-ink-faint text-[11px] leading-relaxed">
          Part of the Persona project (CM3035, Project Idea 7.1). Built to be refused.
        </p>
      </main>
    </>
  );
}
