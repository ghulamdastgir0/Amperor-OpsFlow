"use client";

import { AlertTriangle } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div
            className={
              danger
                ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"
                : "flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-primary"
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
      </div>
    </div>
  );
}
