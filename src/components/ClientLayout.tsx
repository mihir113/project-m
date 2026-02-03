"use client";

import { ToastProvider } from "@/components/Toast";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
