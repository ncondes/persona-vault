import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RecordCard } from "@/components/record-card";
import { initialsOf } from "@/lib/format";
import { SESSION_COOKIE, fetchClaims, persona } from "@/lib/persona";

export default async function HomePage() {
  const store = await cookies();
  const accessToken = store.get(SESSION_COOKIE)?.value;
  if (!accessToken) redirect("/");

  // Re-read on every load rather than caching at sign-in: if the patient edits
  // a value in Persona, or withdraws consent, this reflects it immediately.
  const claims = await fetchClaims(accessToken);
  if (!claims) redirect("/?error=access_denied");

  const shared = Object.keys(claims).filter((key) => key !== "sub").length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="bg-care flex size-8 items-center justify-center rounded-[7px] text-[15px] font-700 text-white"
          >
            +
          </span>
          <span className="font-display text-[15px] font-700 tracking-tight">
            City Health Clinic
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="border-rule bg-card font-data flex size-8 items-center justify-center rounded-full border text-[11px] font-600">
            {initialsOf(claims)}
          </span>
          <form action="/disconnect" method="post">
            <button
              type="submit"
              className="font-display text-ink-soft hover:text-ink text-[13px] font-600 underline underline-offset-4 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="bg-care-soft text-care-deep mt-10 flex items-start gap-3 rounded-lg px-5 py-4">
        <span aria-hidden className="mt-0.5 text-[15px]">
          ✓
        </span>
        <div>
          <p className="font-display text-[15px] font-600">
            Your record is complete. Nothing to fill in.
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed opacity-80">
            Persona released {shared} {shared === 1 ? "field" : "fields"} that you approved. Anything
            you declined is left blank below, and we can still see you without it.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <RecordCard claims={claims} />
      </div>

      <p className="text-ink-soft mt-8 text-[13px] leading-relaxed">
        This clinic stores nothing of its own — every value above is read from your Persona vault
        each time this page loads. Change or withdraw it at any time in{" "}
        <a
          className="text-care underline underline-offset-2"
          href={`${persona.webUrl}/connections`}
        >
          your Persona connections
        </a>
        .
      </p>
    </main>
  );
}
