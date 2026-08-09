import type { Metadata } from "next";
import { Chivo, JetBrains_Mono, Karla } from "next/font/google";
import "./globals.css";

const chivo = Chivo({ variable: "--font-chivo", subsets: ["latin"], weight: ["600", "700", "900"] });
const karla = Karla({ variable: "--font-karla", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Hobbyist Forum",
  description: "Post under the name you choose. Nothing more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${chivo.variable} ${karla.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
