import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/header/SiteHeader";
import { Scrollbar } from "@/components/scrollbar/Scrollbar";
import { REPO_URL, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/content";
import "@/styles/base.css";
import "@/styles/buttons.css";
import "@/styles/header.css";
import "@/styles/home.css";
import "@/styles/pages.css";
import "@/styles/tokens.css";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "Lunar",
  appleWebApp: { title: "Lunar" },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, siteName: "Lunar", locale: "en_US", type: "website" },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const STRUCTURED_DATA = JSON.stringify([
  { "@context": "https://schema.org", "@type": "Organization", name: "Lunar", url: REPO_URL },
  { "@context": "https://schema.org", "@type": "WebSite", name: "Lunar", url: REPO_URL },
]);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body className="font-sans antialiased text-neutral-loud bg-white overflow-x-clip">
        <SiteHeader />
        {children}
        <Scrollbar />
        <script dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }} type="application/ld+json" />
      </body>
    </html>
  );
}
