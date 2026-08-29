"use client";

import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active shadow-[var(--shadow-sm)]",
  secondary: "bg-foreground text-background hover:opacity-90 active:opacity-80",
  outline: "border border-border bg-surface text-foreground hover:bg-surface-2 hover:border-border-strong",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger: "bg-danger text-white hover:opacity-90 active:opacity-80",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
>;

export interface ButtonProps extends NativeButtonProps {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={disabled || isLoading ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </motion.button>
  );
}
