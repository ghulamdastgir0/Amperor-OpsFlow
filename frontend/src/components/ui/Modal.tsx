"use client";

import { X } from "lucide-react";
import { motion } from "motion/react";

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.button
        type="button"
        aria-label="Close"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-lg)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">{title}</p>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
