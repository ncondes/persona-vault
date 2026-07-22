import { AuthorizeView } from "@/components/consent/authorize-view";

export default async function AuthorizePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-6">
      <AuthorizeView uid={uid} />
    </div>
  );
}
