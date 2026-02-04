import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Project M",
  description: "Project-based operations management",
  manifest: "/manifest.json",
  themeColor: "#4f6ff5",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Project M",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>
          <div className="flex min-h-screen">
            {/* Sidebar — always visible on desktop, collapsible on mobile */}
            <Sidebar />

            {/* Main content area — takes up the rest of the screen */}
            <main className="flex-1 overflow-auto pt-16 md:pt-0" style={{ minWidth: 0 }}>
              <div className="max-w-5xl mx-auto p-6">
                {children}
              </div>
            </main>
          </div>
        </ClientLayout>
      </body>
    </html>
  );
}
