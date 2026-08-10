"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/error-message";
import { useStrings } from "@/lib/locale";

// Drops in where a component held its error in useState. The difference is what
// is kept: whatever the request rejected with, rather than the sentence about
// it. A stored sentence is frozen in the language it was written in, so
// switching to Spanish with an error on screen would leave it in English.
export function useErrorMessage(): [string | null, (failure: unknown) => void] {
  const t = useStrings();
  const [failure, setFailure] = useState<unknown>(null);

  return [failure == null ? null : errorMessage(t, failure), setFailure];
}
