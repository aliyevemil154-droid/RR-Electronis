import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dubai Electronics — Your next upgrade, from Dubai to Baku",
    template: "%s | Dubai Electronics",
  },
  description:
    "Discover thoughtfully selected smartphones, laptops, audio, and everyday tech. Dubai Electronics brings your next upgrade from Dubai to Baku, Azerbaijan.",
  applicationName: "Dubai Electronics",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Dubai Electronics",
    description: "Exceptional tech. From Dubai to Baku.",
    type: "website",
    locale: "en_AZ",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173e32",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
