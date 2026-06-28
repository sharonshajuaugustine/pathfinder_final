import type { Metadata } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { CoyotBadge } from "@/components/coyot-logo";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Coyot PathFinder — AI Career Guidance for Plus Two Students | Kerala",
  description:
    "Discover your strengths, interests, and the right career path after Plus Two. Free, guided, and built for Kerala students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${plusJakarta.variable} min-h-screen bg-background antialiased`}
        style={{ fontFamily: "var(--font-body), 'Plus Jakarta Sans', sans-serif" }}
      >
        {children}
        <div style={{ borderTop: "1px solid rgba(30,111,255,0.07)", background: "rgba(255,255,255,0.5)" }}>
          <CoyotBadge />
        </div>
      </body>
    </html>
  );
}
