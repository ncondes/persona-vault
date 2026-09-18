import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RecordCard } from "@/components/record-card";
import { SESSION_COOKIE } from "@/lib/persona";

const ERRORS: Record<string, string> = {
  access_denied: "You declined the request, so nothing was shared.",
  access_ended: "Persona no longer shares your record with us. Fill it in again to continue.",
  invalid_callback: "That sign-in link could not be verified. Start again.",
  token_exchange_failed: "The clinic could not reach Persona. Try again in a moment.",
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
    <main className="mx-auto grid max-w-6xl gap-12 px-6 py-14 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16 lg:py-24">
      <div className="lg:pt-6">
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

        <h1 className="font-display mt-10 max-w-[13ch] text-[clamp(2.4rem,6vw,3.6rem)] leading-[0.98] font-700 tracking-[-0.03em]">
          Your first visit starts without the clipboard.
        </h1>

        <p className="text-ink-soft mt-6 max-w-[46ch] text-[17px] leading-relaxed">
          We need a patient record before your appointment. Rather than asking you to write it out
          again, we ask Persona for it — and you choose, field by field, what we receive.
        </p>

        {error ? (
          <p
            role="alert"
            className="border-alert/25 bg-alert-soft text-alert mt-8 rounded-lg border px-4 py-3 text-[14px]"
          >
            {ERRORS[error] ?? "Something went wrong. Please try again."}
          </p>
        ) : null}

        <a
          href="/connect"
          className="bg-care hover:bg-care-deep font-display mt-9 inline-flex h-12 items-center rounded-lg px-6 text-[15px] font-600 text-white transition-colors"
        >
          Fill this from Persona
        </a>

        <dl className="border-rule mt-12 max-w-[46ch] space-y-3 border-t pt-8">
          <div className="flex gap-3">
            <dt className="font-data text-care w-6 shrink-0 text-[12px]">01</dt>
            <dd className="text-[14px] leading-relaxed">
              Persona shows you exactly which fields this clinic is asking for.
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="font-data text-care w-6 shrink-0 text-[12px]">02</dt>
            <dd className="text-[14px] leading-relaxed">
              You pick a value for each one, and can refuse anything that is not required.
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="font-data text-care w-6 shrink-0 text-[12px]">03</dt>
            <dd className="text-[14px] leading-relaxed">
              We only ever see what you approved, and you can withdraw it at any time.
            </dd>
          </div>
        </dl>
      </div>

      <div className="lg:pt-2">
        <RecordCard claims={null} />
      </div>
    </main>
  );
}
