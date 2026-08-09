import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, Roboto_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Tiger Store",
  description: "Checkout that is already filled in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable} ${robotoMono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
