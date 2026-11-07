import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/design/generated/fonts/fonts.css";
import "@/design/generated/tokens.css";
import "@/design/generated/components.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Handoff",
  description: "A trading layer for tokenized securities, operated by a PSAV.",
  icons: "/design/logos/handoff-app-icon.svg",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
