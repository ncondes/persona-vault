import { t } from "@/lib/strings";

export default async function AuthorizePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-6">
      <p className="text-muted-foreground">
        {t.appName} · {uid}
      </p>
    </div>
  );
}
