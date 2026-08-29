"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Bot,
  Inbox,
  Wallet,
  UserCog,
  ScrollText,
  Tags,
  LogOut,
  Sparkles,
  MoreHorizontal,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/hooks/useAuth";
import { clearAuthToken, usersApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/types";

const FINANCE_ROLES: Role[] = ["SYSTEM_ADMIN", "FINANCE_APPROVER", "DEPARTMENT_MANAGER", "TEAM_LEAD"];

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutGrid, match: (p: string) => p === "/" },
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/requests", label: "Action Hub", icon: Inbox },
  { href: "/finance", label: "Finance", icon: Wallet, roles: FINANCE_ROLES },
  { href: "/admin/delegations", label: "Delegations", icon: UserCog, roles: ["SYSTEM_ADMIN"] as Role[] },
  { href: "/admin/policies", label: "Policies", icon: ScrollText, roles: ["SYSTEM_ADMIN"] as Role[] },
  { href: "/admin/roles", label: "Roles & Messaging", icon: Tags, roles: ["SYSTEM_ADMIN"] as Role[] },
];

// How many nav items fit directly in the mobile bottom bar — the rest live
// behind "More". Whatever role-filtered list a given user ends up with, the
// first 4 are the ones judged most commonly reached for (Home/Assistant/
// Action Hub/Finance for anyone with finance access); everything past that
// is admin/setup-oriented and used far less often.
const BOTTOM_NAV_PRIMARY_COUNT = 4;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  // The JWT's `name` claim can be stale — set once at login, so an older,
  // still-valid token predates this claim or reflects an old name. Fetching
  // the live profile once keeps the sidebar correct without forcing a
  // re-login just to see a name/avatar change.
  const [liveName, setLiveName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    usersApi
      .getMyProfile()
      .then((profile) => setLiveName(profile.name))
      .catch(() => {});
  }, [user]);

  const displayName = liveName || user?.name || user?.email || "";

  function handleSignOut() {
    clearAuthToken();
    router.push("/login");
  }

  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  const primaryItems = items.slice(0, BOTTOM_NAV_PRIMARY_COUNT);
  const overflowItems = items.slice(BOTTOM_NAV_PRIMARY_COUNT);

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    return item.match ? item.match(pathname) : pathname.startsWith(item.href);
  }

  return (
    <>
      {/* Desktop / tablet: full left sidebar */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" aria-hidden />
          </div>
          <span className="font-heading text-base font-semibold text-foreground">OpsFlow</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 rounded-lg bg-primary-tint"
                  />
                )}
                <Icon className="relative size-4" aria-hidden />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-4 py-3">
          <ThemeToggle />
        </div>

        {user && (
          <div className="flex items-center gap-2.5 border-t border-border px-4 py-4">
            <Link
              href="/profile"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md -m-1.5 p-1.5 transition-colors hover:bg-surface-2"
            >
              <Avatar name={displayName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted">{user.role.replace(/_/g, " ")}</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile: bottom nav, most-used items + More */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-surface md:hidden">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="truncate px-1">{item.label}</span>
            </Link>
          );
        })}
        {(overflowItems.length > 0 || user) && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted"
          >
            <MoreHorizontal className="size-5" aria-hidden />
            <span>More</span>
          </button>
        )}
      </nav>

      {/* Mobile: "More" sheet — remaining nav items, theme, profile, sign out */}
      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setMoreOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-lg)]"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-heading text-sm font-semibold text-foreground">More</span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close"
                  className="rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="flex max-h-[60vh] flex-col overflow-y-auto px-2 py-2">
                {overflowItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-primary-tint text-primary" : "text-foreground hover:bg-surface-2",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}

                {overflowItems.length > 0 && <div className="my-2 border-t border-border" />}

                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium text-foreground">Theme</span>
                  <ThemeToggle />
                </div>

                {user && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <Link
                      href="/profile"
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <Avatar name={displayName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                        <p className="truncate text-xs text-muted">{user.role.replace(/_/g, " ")}</p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        handleSignOut();
                      }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-tint"
                    >
                      <LogOut className="size-4" aria-hidden />
                      Sign out
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
