"use client";

import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { useStrings } from "@/lib/locale";

interface ToastOptions {
  // Reuse an id when the same control can fire twice in quick succession, so
  // the second toast replaces the first instead of stacking on it.
  id?: string;
}

// The two things every mutation says: it worked, or here is why it did not.
// Building the sentence lives in @/lib/error-message, where it is tested; this
// is only the binding to sonner, which cannot run without a DOM.
export function useToast() {
  const t = useStrings();

  return {
    success: (message: string, options?: ToastOptions) => toast.success(message, options),
    failure: (err: unknown, options?: ToastOptions) =>
      toast.error(errorMessage(t, err), options),
  };
}
