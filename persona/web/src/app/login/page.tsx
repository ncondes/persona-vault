import { t } from "@/lib/strings";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-6">
      <p className="text-muted-foreground">{t.auth.signIn}</p>
    </div>
  );
}
