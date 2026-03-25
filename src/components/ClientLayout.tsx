"use client";

import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationManager } from "@/components/NotificationManager";
import { Sidebar } from "@/components/Sidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <ThemeProvider>
      <ToastProvider>
        {isLoginPage ? (
          children
        ) : (
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto pt-16 md:pt-0" style={{ minWidth: 0 }}>
              <div className="max-w-[1400px] mx-auto p-6">{children}</div>
            </main>
          </div>
        )}
        <CommandPalette />
        <NotificationManager />
      </ToastProvider>
    </ThemeProvider>
  );
}
