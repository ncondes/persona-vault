import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { t } from "@/lib/strings";

export default async function LandingPage() {
  const cookieStore = await cookies();
  if (cookieStore.has("token")) redirect("/vault");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-6">
      <div className="flex w-full max-w-sm flex-col">
        <Logo size="lg" className="mb-7" />
        <h1 className="text-3xl font-semibold tracking-tight">{t.landing.title}</h1>
        <p className="mt-3 text-zinc-600">{t.landing.body}</p>

        <ul className="mt-8 space-y-4">
          {t.landing.points.map((point) => (
            <li key={point} className="flex items-center gap-3 text-[15px] text-zinc-800">
              <span className="bg-brand-tint text-brand flex size-7 shrink-0 items-center justify-center rounded-lg">
                <Check className="size-4" />
              </span>
              {point}
            </li>
          ))}
        </ul>

        <Button size="xl" className="mt-10 w-full" asChild>
          <Link href="/signup">{t.landing.cta}</Link>
        </Button>
        <Button size="xl" variant="ghost" className="mt-2 w-full" asChild>
          <Link href="/login">{t.landing.signIn}</Link>
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">{t.onboarding.welcomeNote}</p>
      </div>
    </div>
  );
}
