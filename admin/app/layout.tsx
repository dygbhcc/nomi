import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nomi Admin - Demand Intelligence Dashboard",
  description: "B2B demand intelligence dashboard for Nomi restaurant partners",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
