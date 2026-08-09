import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrderSummary, Wordmark } from "@/components/store";
import { SESSION_COOKIE } from "@/lib/persona";

const ERRORS: Record<string, string> = {
  access_denied: "You declined, so nothing was shared. Your basket is still here.",
  invalid_callback: "That sign-in link could not be verified. Start again.",
  token_exchange_failed: "We could not reach Persona. Try again in a moment.",
};

const FIELDS = ["Name", "Shipping address", "Phone", "Email", "Account handle"];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const store = await cookies();
  if (store.has(SESSION_COOKIE)) redirect("/home");

  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
      <Wordmark />

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div>
          <p className="font-data text-tiger-deep text-[11px] tracking-[0.2em] uppercase">
            Checkout · step 1 of 1
          </p>
          <h1 className="font-display mt-3 max-w-[15ch] text-[clamp(2.2rem,5.5vw,3.4rem)] leading-[0.98] font-800 tracking-[-0.035em]">
            Nobody wants to type their address again.
          </h1>
          <p className="text-ink-soft mt-5 max-w-[44ch] text-[16px] leading-relaxed">
            So don&apos;t. Bring your details from Persona and the label prints itself. You approve
            each field, and you can change your mind later without emailing us about it.
          </p>

          {error ? (
            <p
              role="alert"
              className="border-tiger/30 bg-tiger-soft text-tiger-deep mt-7 rounded-xl border px-4 py-3 text-[14px]"
            >
              {ERRORS[error] ?? "Something went wrong. Please try again."}
            </p>
          ) : null}

          <a
            href="/connect"
            className="bg-tiger hover:bg-tiger-deep font-display mt-8 inline-flex h-13 items-center rounded-full px-7 text-[16px] font-700 text-white transition-colors"
          >
            Continue with Persona
          </a>

          <div className="border-line mt-10 border-t pt-6">
            <p className="font-display text-ink-soft text-[11px] font-700 tracking-[0.16em] uppercase">
              We will ask for
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {FIELDS.map((field) => (
                <li
                  key={field}
                  className="border-line bg-kraft font-data rounded-full border px-3 py-1 text-[12px]"
                >
                  {field}
                </li>
              ))}
            </ul>
            <p className="text-ink-soft mt-3 text-[13px]">
              Not your date of birth, and not your ID. A shop is not a border crossing.
            </p>
          </div>
        </div>

        <div className="lg:pt-14">
          <OrderSummary />
        </div>
      </div>
    </main>
  );
}
