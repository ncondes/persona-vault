import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const cookieStore = await cookies();
  if (cookieStore.has("token")) redirect("/vault");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-6">
      <LoginForm />
    </div>
  );
}
