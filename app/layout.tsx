import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Marcellus, Ramabhadra } from "next/font/google";
import { wedding } from "@/content/wedding";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const text = Marcellus({
  variable: "--font-text",
  subsets: ["latin"],
  weight: "400",
});

const telugu = Ramabhadra({
  variable: "--font-telugu",
  subsets: ["telugu"],
  weight: "400",
});

export const metadata: Metadata = {
  title: `${wedding.groom} & ${wedding.bride} — wedding invitation`,
  description: `${wedding.groom} and ${wedding.bride} invite you to their wedding. ${wedding.dateLine}, ${wedding.city}.`,
};

export const viewport: Viewport = {
  themeColor: "#120818",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${telugu.variable}`}>
      <body>{children}</body>
    </html>
  );
}
