"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/cn";

const CYCLE_ORDER = ["light", "dark", "system"] as const;
const CYCLE_ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const CYCLE_LABEL = { light: "Light", dark: "Dark", system: "System" } as const;

// Single-icon toggle: shows the icon for the *selected* preference (not the
// resolved color, so "system" reads as Monitor even if that resolves to dark
// right now) and clicking cycles light -> dark -> system -> light. Keeps a
// single glyph on screen while still reaching every option the full
// three-way ThemeToggle exposes.
export function CompactThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  if (!theme) {
    return <div className={cn("size-8 rounded-md", className)} />;
  }

  const current = (theme in CYCLE_ICON ? theme : "system") as (typeof CYCLE_ORDER)[number];
  const next = CYCLE_ORDER[(CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length];
  const Icon = CYCLE_ICON[current];

  return (
    <button
      type="button"
      title={`Theme: ${CYCLE_LABEL[current]} (click for ${CYCLE_LABEL[next]})`}
      aria-label={`Theme: ${CYCLE_LABEL[current]}. Switch to ${CYCLE_LABEL[next]}`}
      onClick={() => setTheme(next)}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/10",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

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
