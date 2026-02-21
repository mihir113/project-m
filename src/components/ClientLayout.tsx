"use client";

import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationManager } from "@/components/NotificationManager";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        {children}
        <CommandPalette />
        <NotificationManager />
      </ToastProvider>
    </ThemeProvider>
  );
}
