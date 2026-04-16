import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Makler — AI Trading",
  description: "Инвестиционная платформа AI Маклера",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
