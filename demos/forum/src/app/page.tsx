import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Masthead, Panel, Post } from "@/components/board";
import { SESSION_COOKIE } from "@/lib/persona";

const ERRORS: Record<string, string> = {
  access_denied: "You declined, so nothing was shared. You can still read the board.",
  access_ended: "Persona no longer shares your details with the board. You can still read it.",
  invalid_callback: "That sign-in link could not be verified. Start again.",
  token_exchange_failed: "The board could not reach Persona. Try again in a moment.",
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const store = await cookies();
  if (store.has(SESSION_COOKIE)) redirect("/home");

  const { error } = await searchParams;

  return (
    <>
      <Masthead
        signedIn={
          <a
            href="/connect"
            className="font-display rounded-[3px] bg-white/15 px-3 py-1.5 text-[12px] font-700 text-white transition-colors hover:bg-white/25"
          >
            Sign in
          </a>
        }
      />

      <main className="mx-auto max-w-4xl space-y-5 px-5 py-7">
        <div>
          <p className="font-data text-ink-soft text-[11px]">Boards › Restoration › Lathes</p>
          <h1 className="font-display mt-1.5 text-[26px] leading-tight font-700 tracking-tight">
            Anyone else running a 1954 Myford ML7?
          </h1>
        </div>

        {error ? (
          <p
            role="alert"
            className="border-marker/30 bg-marker-soft text-marker rounded-[3px] border px-4 py-3 text-[14px]"
          >
            {ERRORS[error] ?? "Something went wrong. Please try again."}
          </p>
        ) : null}

        <Panel title="Thread · 2 replies">
          <Post handle="oldiron" displayName="Old Iron" postNumber={1} joined="2011-03-04">
            <p>
              Picked one up at a farm sale last weekend. The bed is in better shape than the photos
              suggested, but the countershaft bearings are shot. Before I start ordering parts — is
              anyone still running one of these daily?
            </p>
          </Post>
          <Post handle="swarf_and_tea" displayName="Swarf" postNumber={2} joined="2016-09-22">
            <p>
              Daily for eleven years. Replace the bearings with the sealed ones, not the originals.
              You will never look at them again.
            </p>
          </Post>
        </Panel>

        <Panel title="Reply">
          <div className="p-5">
            <div className="border-line bg-board/50 text-ink-soft rounded-[3px] border border-dashed px-5 py-8 text-center">
              <p className="font-display text-ink text-[15px] font-700">
                Members can reply to this thread.
              </p>
              <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed">
                We ask Persona for two things: a name to show on your posts, and a handle. Not your
                email, not your phone, not where you live. A forum has no business knowing those.
              </p>
              <a
                href="/connect"
                className="bg-marker font-display mt-6 inline-flex h-11 items-center rounded-[3px] px-6 text-[14px] font-700 text-white transition-opacity hover:opacity-90"
              >
                Join with Persona
              </a>
            </div>
          </div>
        </Panel>
      </main>
    </>
  );
}
