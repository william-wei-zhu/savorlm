import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree, DM_Mono } from "next/font/google";
import { Providers } from "./providers";
import { NAME, SITE, SUBTITLE, TAGLINE } from "@/lib/brand";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["600", "700", "800"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], weight: ["600", "700", "800"] });
const dmMono = DM_Mono({ variable: "--font-dmmono", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: `${NAME}: ${TAGLINE}`, template: `%s | ${NAME}` },
  description: `${TAGLINE}. ${SUBTITLE}`,
  openGraph: { title: NAME, description: `${TAGLINE}. ${SUBTITLE}`, siteName: NAME, type: "website" },
  twitter: { card: "summary_large_image", title: NAME, description: `${TAGLINE}. ${SUBTITLE}` },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#161110" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${figtree.variable} ${dmMono.variable} antialiased`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
