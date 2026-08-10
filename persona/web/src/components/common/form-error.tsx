import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// The one way a problem is written on screen. The icon keeps it from reading as
// body text, and role="alert" gets it announced the moment it appears — a
// message that only turns red is easy to miss and impossible to hear.
export function FormError({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p id={id} role="alert" className={cn("flex gap-1.5 text-sm text-destructive", className)}>
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
