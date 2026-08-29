"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, XCircle, X, Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

// Opaque `bg-surface` base (not the translucent `*-tint` tokens) so a toast
// stays readable in dark mode and when it stacks over a modal backdrop — the
// tone now reads from a colored left accent + icon, not a see-through fill.
const TONE_CLASSES: Record<ToastType, string> = {
  success: "border-success/30 border-l-[3px] border-l-success [&_svg]:text-success",
  error: "border-danger/30 border-l-[3px] border-l-danger [&_svg]:text-danger",
  info: "border-info/30 border-l-[3px] border-l-info [&_svg]:text-info",
};

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.type];
            return (
              <motion.div
                key={toast.id}
                role="status"
                layout
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-surface px-4 py-3 text-sm text-foreground shadow-[var(--shadow-lg)]",
                  TONE_CLASSES[toast.type],
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p className="flex-1">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
                  aria-label="Dismiss"
                >
                  <X className="size-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
