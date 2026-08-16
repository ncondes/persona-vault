import type { Metadata } from "next";
import "./globals.css";

// No `next/font/google` here, unlike the three honest demos. Probe is the app a
// marker is most likely to run last, on whatever network is to hand, and a
// relying party that will not render without reaching a font CDN is a poor
// thing to stake a demonstration on. The stacks in globals.css are local.

export const metadata: Metadata = {
  title: "Probe — adversarial relying party",
  description: "A registered Persona client that misbehaves on purpose, to show what is refused.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
