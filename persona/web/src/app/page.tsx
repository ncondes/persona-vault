import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/common/public-header";
import { getStrings } from "@/lib/strings";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function LandingPage() {
  const cookieStore = await cookies();
  if (cookieStore.has("token")) redirect("/vault");
  const t = getStrings(cookieStore.get("locale")?.value);

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-b from-[#268494] via-brand to-[#144b57] px-6 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 left-1/2 size-[540px] -translate-x-1/2 rounded-full bg-white/15 blur-[130px]"
      />

      <PublicHeader tone="light" wordmark />

      <div className="animate-in fade-in slide-in-from-bottom-4 relative z-10 flex w-full max-w-sm flex-col duration-700">
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight">
          {t.landing.title}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/75">{t.landing.body}</p>

        <ul className="mt-8 space-y-3">
          {t.landing.points.map((point) => (
            <li key={point} className="flex items-center gap-3 text-[15px] text-white/90">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25">
                <CheckIcon />
              </span>
              {point}
            </li>
          ))}
        </ul>

        <Button size="xl" className="mt-10 w-full bg-white text-brand hover:bg-white/90" asChild>
          <Link href="/signup">{t.landing.cta}</Link>
        </Button>
        <Button
          size="xl"
          variant="ghost"
          className="mt-2 w-full text-white hover:bg-white/10 hover:text-white"
          asChild
        >
          <Link href="/login">{t.landing.signIn}</Link>
        </Button>
        <p className="mt-5 text-center text-sm text-white/55">{t.onboarding.welcomeNote}</p>
        <Link
          href="/docs"
          className="mt-6 inline-flex items-center justify-center gap-1 text-center text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
        >
          {t.landing.docs}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
