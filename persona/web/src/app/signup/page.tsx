import { t } from "@/lib/strings";

export default function SignupPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-6">
      <p className="text-muted-foreground">{t.auth.signUp}</p>
    </div>
  );
}
