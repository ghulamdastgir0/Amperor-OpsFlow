"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // `theme` is undefined until next-themes has read localStorage on the
  // client — render an inert placeholder rather than guessing, to avoid a
  // hydration mismatch.
  if (!theme) {
    return <div className="h-[30px] rounded-lg bg-slate-100 dark:bg-white/5" />;
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/5">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-label={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors",
              isActive
                ? "bg-surface text-primary shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
