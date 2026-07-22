import { LanguageToggle } from "./language-toggle";
import { Logo } from "./logo";

// The shared top chrome for the public pages: a home logo on the left and the
// language toggle on the right, same size and position everywhere.
export function PublicHeader({
  tone = "brand",
  wordmark = false,
}: {
  tone?: "brand" | "light";
  wordmark?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-2.5">
        <Logo href="/" tone={tone} size="sm" />
        {wordmark ? <span className="text-lg font-semibold tracking-tight">Persona</span> : null}
      </div>
      <LanguageToggle />
    </div>
  );
}
