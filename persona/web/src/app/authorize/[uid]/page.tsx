import { LanguageToggle } from "@/components/common/language-toggle";
import { AuthorizeView } from "@/components/consent/authorize-view";

export default async function AuthorizePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-6">
      <div className="fixed top-4 right-4">
        <LanguageToggle />
      </div>
      <AuthorizeView uid={uid} />
    </div>
  );
}
