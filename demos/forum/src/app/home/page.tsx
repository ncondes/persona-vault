import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Masthead, Panel, Post, displayNameOf, handleOf } from "@/components/board";
import { SESSION_COOKIE, fetchClaims, persona } from "@/lib/persona";

// Persona can release all of these. This board asks for none of them, and
// saying so plainly is the most honest thing the page can do.
const NEVER_REQUESTED = [
  "Email address",
  "Phone number",
  "Home address",
  "Date of birth",
  "Identity document",
  "Blood type",
  "Health insurer",
  "Allergies",
];

export default async function HomePage() {
  const store = await cookies();
  const accessToken = store.get(SESSION_COOKIE)?.value;
  if (!accessToken) redirect("/");

  // Re-read on every load: if the member renames themselves in Persona, their
  // posts here follow along.
  const claims = await fetchClaims(accessToken);
  if (!claims) redirect("/access-ended");

  const handle = handleOf(claims);
  const displayName = displayNameOf(claims);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Masthead
        signedIn={
          <div className="flex items-center gap-3">
            <span className="font-data text-[12px] text-white/80">{handle}</span>
            <form action="/disconnect" method="post">
              <button
                type="submit"
                className="font-display rounded-[3px] bg-white/15 px-3 py-1.5 text-[12px] font-700 text-white transition-colors hover:bg-white/25"
              >
                Sign out
              </button>
            </form>
          </div>
        }
      />

      <main className="mx-auto max-w-4xl space-y-5 px-5 py-7">
        <div>
          <p className="font-data text-ink-soft text-[11px]">Boards › Restoration › Lathes</p>
          <h1 className="font-display mt-1.5 text-[26px] leading-tight font-700 tracking-tight">
            {displayName}, welcome to the board.
          </h1>
        </div>

        <Panel
          title="Your first post"
          right={<span className="font-data text-[11px] text-white/70">just now</span>}
        >
          <Post handle={handle} displayName={displayName} postNumber={3} joined={today}>
            <p>
              Long-time reader, finally signed up. Bought a ML7 last month and the countershaft
              bearings are, as predicted, shot. Ordering the sealed ones.
            </p>
            <p className="text-ink-soft text-[13px] italic">
              — posted under the name I chose, not the one on my ID
            </p>
          </Post>
        </Panel>

        <Panel title="What this board knows about you">
          <div className="p-5">
            <dl className="border-line divide-line divide-y overflow-hidden rounded-[3px] border">
              <div className="bg-board/40 flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-[13px]">Display name</dt>
                <dd className="font-data text-[13.5px] font-500">{displayName}</dd>
              </div>
              <div className="bg-board/40 flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-[13px]">Handle</dt>
                <dd className="font-data text-[13.5px] font-500">{handle}</dd>
              </div>
            </dl>

            <p className="text-ink-soft mt-5 text-[13px] leading-relaxed">
              That is the entire record. Persona holds a great deal more about you, and this board
              never asked for any of it:
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {NEVER_REQUESTED.map((field) => (
                <li
                  key={field}
                  className="border-line text-ink-soft font-data rounded-[3px] border border-dashed px-2 py-1 text-[11px] line-through"
                >
                  {field}
                </li>
              ))}
            </ul>

            <p className="text-ink-soft mt-5 text-[13px] leading-relaxed">
              Compare that with what a clinic asks for. Same vault, same person, a very different
              request — see it in{" "}
              <a className="text-chrome-2 underline underline-offset-2" href={`${persona.webUrl}/connections`}>
                your Persona connections
              </a>
              .
            </p>
          </div>
        </Panel>
      </main>
    </>
  );
}
