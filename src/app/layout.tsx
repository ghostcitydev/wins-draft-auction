import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "2026 NFL Wins Draft",
  description: "Live standings for the 2026 NFL wins draft auction pool",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wins Draft",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e14" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Runs before paint to apply a manually-chosen theme (light/dark) from
// localStorage, avoiding a flash of the wrong theme. If nothing's been
// chosen, the CSS `prefers-color-scheme` media query handles it instead.
const themeInitScript = `
(function() {
  try {
    var stored = window.localStorage.getItem("wins-draft-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex-1 pb-24">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
