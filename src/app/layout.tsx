import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PathFinder — AI Career Guidance for Plus Two Students | Kerala",
  description:
    "Discover your strengths, interests, and the right career path after Plus Two. Free, guided, and built for Kerala students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
