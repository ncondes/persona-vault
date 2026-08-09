"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useStrings } from "@/lib/locale"

// The registry version reads the theme from next-themes. This app is light-only
// and does not install it, so the theme is pinned.
//
// Sonner injects its stylesheet into <head> at runtime, so its rules outrank
// ours on a tie. That is why `font-sans` goes on the toast itself rather than on
// the container, and why the type of a toast is carried by the icon colour
// instead of a background: a background utility would lose to --normal-bg.
function Toaster({ ...props }: ToasterProps) {
  const t = useStrings()

  return (
    <Sonner
      theme="light"
      position="bottom-right"
      duration={4000}
      closeButton
      className="toaster group"
      containerAriaLabel={t.common.notifications}
      icons={{
        success: <CircleCheckIcon className="size-4 text-brand" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4 text-sensitive" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: t.common.dismiss,
        classNames: { toast: "font-sans" },
      }}
      {...props}
    />
  )
}

export { Toaster }
