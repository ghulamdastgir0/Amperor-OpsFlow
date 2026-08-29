"use client";

import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 bg-black/50"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-start gap-3">
          <div
            className={
              danger
                ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger"
                : "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"
            }
          >
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
