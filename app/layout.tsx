import type { Metadata } from "next";
import { Caveat, Courier_Prime } from "next/font/google";
import { DoodleFilters } from "@/components/DoodleFilters";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-caveat",
  display: "swap",
});

const courier = Courier_Prime({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-courier",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DoodleBooth",
  description: "Pixel art photobooth powered by Claude",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${caveat.variable} ${courier.variable}`}>
      <body>
        {children}
        <DoodleFilters />
      </body>
    </html>
  );
}
