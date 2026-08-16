import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ATTACKS, type Outcome, runAll, runAttack } from "@/lib/attacks";
import { SPENT_CODE_COOKIE } from "@/lib/attacks-session";
import { SESSION_COOKIE, persona } from "@/lib/persona";
import { Masthead, Panel, Verdict } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string }>;
}) {
  const store = await cookies();
  const accessToken = store.get(SESSION_COOKIE)?.value;
  if (!accessToken) redirect("/");

  const { replay } = await searchParams;
  const context = { accessToken, usedCode: store.get(SPENT_CODE_COOKIE)?.value };

  const outcomes: Record<string, Outcome> = await runAll(context);
  if (replay === "1") {
    outcomes["code-replay"] = await runAttack("code-replay", context);
  }

  const ran = ATTACKS.filter((attack) => outcomes[attack.id]);
  const held = ran.filter((attack) => outcomes[attack.id].status === "held").length;
  const broken = ran.filter((attack) => outcomes[attack.id].status === "broken").length;

  return (
    <>
      <Masthead
        action={
          <form action="/disconnect" method="post">
            <button className="border-line bg-panel-2 font-data rounded-[3px] border px-3 py-1.5 text-[11px] transition-colors hover:bg-[#2b303a]">
              drop session
            </button>
          </form>
        }
      />

      <main className="mx-auto max-w-5xl space-y-5 px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[22px] leading-tight font-700 tracking-tight">
              Attack console
            </h1>
            <p className="text-ink-soft mt-1.5 text-[14px]">
              Connected as a registered client. Every check below just ran against{" "}
              <span className="font-data text-ink-faint">{persona.publicUrl}</span>.
            </p>
          </div>
          <div className="font-data flex gap-2 text-[11px]">
            <span className="border-held/40 bg-held-soft text-held rounded-[3px] border px-2.5 py-1.5">
              {held} blocked
            </span>
            <span
              className={
                broken > 0
                  ? "border-broken/50 bg-broken-soft text-broken rounded-[3px] border px-2.5 py-1.5"
                  : "border-line text-ink-faint rounded-[3px] border px-2.5 py-1.5"
              }
            >
              {broken} got through
            </span>
          </div>
        </div>

        {broken > 0 ? (
          <p
            role="alert"
            className="border-broken/50 bg-broken-soft text-broken rounded-[3px] border px-4 py-3 text-[14px]"
          >
            An attack succeeded. That is a real defect in Persona, not a demo feature — it belongs in
            the evaluation chapter as a finding.
          </p>
        ) : null}

        <Panel title="Results" note={`${ran.length} of ${ATTACKS.length} run`}>
          <ul className="divide-line divide-y">
            {ATTACKS.map((attack, index) => {
              const outcome = outcomes[attack.id];

              return (
                <li key={attack.id} className="px-4 py-4">
                  <div className="flex items-start gap-4">
                    <span className="font-data text-ink-faint pt-1 text-[11px] tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-[15px] font-medium">{attack.title}</h3>
                        <span className="font-data text-ink-faint text-[11px]">{attack.threat}</span>
                      </div>

                      <p className="text-ink-soft text-[13.5px] leading-relaxed">{attack.method}</p>

                      {outcome ? (
                        <div className="border-line bg-shell overflow-x-auto rounded-[3px] border">
                          <table className="font-data w-full text-[11.5px]">
                            <tbody className="divide-line divide-y">
                              <tr>
                                <td className="text-ink-faint w-[74px] px-3 py-2 align-top">sent</td>
                                <td className="px-3 py-2 break-all">{outcome.request}</td>
                              </tr>
                              <tr>
                                <td className="text-ink-faint px-3 py-2 align-top">back</td>
                                <td className="px-3 py-2 break-all">{outcome.response}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="font-data text-ink-faint text-[11.5px]">
                          not run — {attack.expected}
                        </p>
                      )}

                      {outcome?.detail ? (
                        <p className="text-ink-soft text-[13px] leading-relaxed">{outcome.detail}</p>
                      ) : null}

                      {attack.destructive && !outcome ? (
                        <a
                          href="/console?replay=1"
                          className="border-broken/40 bg-broken-soft text-broken font-data inline-flex h-8 items-center rounded-[3px] border px-3 text-[11px] transition-opacity hover:opacity-80"
                        >
                          run it — this ends the session
                        </a>
                      ) : null}
                    </div>

                    {outcome ? <Verdict state={outcome.status} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Two that need you">
          <div className="text-ink-soft space-y-3 px-4 py-4 text-[13.5px] leading-relaxed">
            <p>
              <span className="text-ink font-medium">Revocation.</span> Open{" "}
              <a
                href={`${persona.webUrl}/connections`}
                className="text-ink underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                your connections in Persona
              </a>
              , revoke Probe, then reload this page. Check 10 should turn from inconclusive to
              blocked — the token Probe is still holding stops working at the next call.
            </p>
            <p>
              <span className="text-ink font-medium">Code replay.</span> Check 9 offers back the
              authorization code Probe already spent. A correct provider refuses it and drops the
              whole grant, treating reuse as evidence the code was stolen — so running it logs Probe
              out. That is the right behaviour, which is why it is behind its own button.
            </p>
          </div>
        </Panel>
      </main>
    </>
  );
}
