import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/common/public-header";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export default async function SignupPage() {
  const cookieStore = await cookies();
  if (cookieStore.has("token")) redirect("/vault");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-6">
      <PublicHeader />
      <OnboardingWizard />
    </div>
  );
}
