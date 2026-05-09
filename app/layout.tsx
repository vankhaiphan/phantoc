import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Cormorant_Garamond } from "next/font/google";
import config from "./config";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  variable: "--font-playfair",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${config.siteName} — ${config.siteSubtitle}`,
  description:
    "Gia phả số của họ Phan, làng Cẩm Nê, thành phố Đà Nẵng. Một nơi yên tĩnh để ghi nhớ, gìn giữ và truyền lại.",
  icons: { icon: "/favicon.ico" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: config.siteName,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Allow pinch-zoom on body content; tree visualization manages its own
  // gesture surface and overrides this locally.
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4ECDC" },
    { media: "(prefers-color-scheme: dark)", color: "#13110E" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi-VN">
      <body
        className={`${inter.variable} ${playfair.variable} ${cormorant.variable} antialiased relative parchment-grain`}
      >
        {children}
      </body>
    </html>
  );
}
