import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/providers/AppProvider";

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-devanagari", display: "swap" });

export const metadata: Metadata = {
  title: "SaharaCare — Medicine support for your family",
  description: "Secure medicine reminders, dose history, and family caregiver support.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${notoSans.variable} ${notoDevanagari.variable}`}>
      <body><AppProvider>{children}</AppProvider></body>
    </html>
  );
}
