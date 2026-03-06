import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LoveLens — Capturing Love Beyond Distance",
  description:
    "Take cute photobooth memories together even when you're far apart. A virtual photobooth for long-distance couples.",
  keywords: [
    "long distance",
    "couple photobooth",
    "virtual photobooth",
    "love",
    "memories",
    "photo strip",
  ],
  openGraph: {
    title: "LoveLens — Capturing Love Beyond Distance",
    description:
      "Take cute photobooth memories together even when you're far apart.",
    type: "website",
    siteName: "LoveLens",
  },
  twitter: {
    card: "summary_large_image",
    title: "LoveLens — Capturing Love Beyond Distance",
    description:
      "Take cute photobooth memories together even when you're far apart.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
