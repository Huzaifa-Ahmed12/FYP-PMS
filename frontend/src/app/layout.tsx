import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DG-PdM Manager Console",
  description: "AI-based predictive maintenance for commercial diesel generators",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}