"use client";

import { useState } from "react";
import { getCatalog } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import {
  ContactStep,
  DocumentStep,
  EssentialsStep,
  HealthStep,
  SuccessStep,
} from "./steps";

const TOTAL = 4; // essentials, contact, document, health

// The sign-up wizard. Essentials registers the account (and sets the session
// cookie); the optional steps write straight into the new vault.
export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [itemsSaved, setItemsSaved] = useState(0);
  const { data: catalog } = useLoad(getCatalog);

  const advance = (added: number) => {
    setItemsSaved((count) => count + added);
    setStep((current) => current + 1);
  };

  switch (step) {
    case 0:
      return <EssentialsStep total={TOTAL} done={1} onDone={advance} onName={setFullName} />;
    case 1:
      // no back once the account exists
      return <ContactStep total={TOTAL} done={2} onDone={advance} catalog={catalog} />;
    case 2:
      return (
        <DocumentStep
          total={TOTAL}
          done={3}
          onDone={advance}
          onBack={() => setStep(1)}
          catalog={catalog}
        />
      );
    case 3:
      return (
        <HealthStep
          total={TOTAL}
          done={4}
          onDone={advance}
          onBack={() => setStep(2)}
          catalog={catalog}
        />
      );
    default:
      return <SuccessStep fullName={fullName} itemsSaved={itemsSaved} />;
  }
}
