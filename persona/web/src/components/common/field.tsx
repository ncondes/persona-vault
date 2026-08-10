"use client";

import { cloneElement, isValidElement, useId } from "react";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/common/form-error";

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

// Label + control + optional hint/error line. The hint states the rule before
// anyone breaks it; the error replaces it once someone has.
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  const messageId = useId();

  // Every control in ui/ already styles `aria-invalid`, so marking the child is
  // all the red ring costs. It reaches a single element — an Input, a
  // SelectTrigger — and quietly does nothing for a wrapper holding several,
  // where the message alone has to carry it.
  const control =
    error && isValidElement<Record<string, unknown>>(children)
      ? cloneElement(children, { "aria-invalid": true, "aria-describedby": messageId })
      : children;

  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {control}
      {error ? (
        <FormError id={messageId}>{error}</FormError>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
