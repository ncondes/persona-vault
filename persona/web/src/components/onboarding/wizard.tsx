"use client";

import { useState } from "react";
import { getCatalog } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import type { OtpChallenge } from "@/lib/types";
import {
  ContactStep,
  DocumentStep,
  EssentialsStep,
  HealthStep,
  SuccessStep,
  VerifyStep,
} from "./steps";

const TOTAL = 5; // essentials, verify, contact, document, health

// The sign-up wizard. Essentials collects the details and asks for a code;
// verify is where the account and the session cookie appear. The optional steps
// after it write straight into the new vault.
export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [itemsSaved, setItemsSaved] = useState(0);
  const { data: catalog } = useLoad(getCatalog);

  const advance = (added: number) => {
    setItemsSaved((count) => count + added);
    setStep((current) => current + 1);
  };

  switch (step) {
    case 0:
      return (
        <EssentialsStep
          total={TOTAL}
          done={1}
          onDone={advance}
          onName={setFullName}
          onChallenge={setChallenge}
        />
      );
    case 1:
      // Going back re-sends the essentials, which lands on the same challenge.
      return (
        <VerifyStep
          total={TOTAL}
          done={2}
          onDone={advance}
          onBack={() => setStep(0)}
          challenge={challenge!}
        />
      );
    case 2:
      // no back once the account exists
      return <ContactStep total={TOTAL} done={3} onDone={advance} catalog={catalog} />;
    case 3:
      return (
        <DocumentStep
          total={TOTAL}
          done={4}
          onDone={advance}
          onBack={() => setStep(2)}
          catalog={catalog}
        />
      );
    case 4:
      return (
        <HealthStep
          total={TOTAL}
          done={5}
          onDone={advance}
          onBack={() => setStep(3)}
          catalog={catalog}
        />
      );
    default:
      return <SuccessStep fullName={fullName} itemsSaved={itemsSaved} />;
  }
}
