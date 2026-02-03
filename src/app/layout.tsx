import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Project M",
  description: "Project-based operations management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <ClientLayout>
          <div className="flex min-h-screen">
            {/* Sidebar — always visible on desktop, collapsible on mobile */}
            <Sidebar />

            {/* Main content area — takes up the rest of the screen */}
            <main className="flex-1 overflow-auto" style={{ minWidth: 0 }}>
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
