import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Wins Draft Auction",
  description: "Live standings for the NFL wins draft auction pool",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wins Draft",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex-1 pb-24">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
