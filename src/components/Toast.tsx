"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ─── Toast Context — allows any component to trigger a toast ───
interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// ─── Provider — wraps your app and renders toasts ───
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let nextId = 0;

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const colors = {
    success: { bg: "rgba(52,211,153,0.12)", border: "#34d399", text: "#34d399", icon: "✓" },
    error:   { bg: "rgba(248,113,113,0.12)", border: "#f87171", text: "#f87171", icon: "✕" },
    info:    { bg: "rgba(79,111,245,0.12)", border: "#4f6ff5", text: "#4f6ff5", icon: "i" },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2" style={{ maxWidth: "340px" }}>
        {toasts.map((toast) => {
          const c = colors[toast.type];
          return (
            <div
              key={toast.id}
              className="flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slideUp"
              style={{ backgroundColor: "#171923", borderColor: c.border }}
            >
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: c.bg, color: c.text }}
              >
                {c.icon}
              </span>
              <p className="text-sm text-primary">{toast.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
