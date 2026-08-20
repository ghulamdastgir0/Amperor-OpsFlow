"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Bot, Inbox, Wallet, UserCog, ScrollText, Tags, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { clearAuthToken } from "@/lib/api";
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

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  function handleSignOut() {
    clearAuthToken();
    router.push("/login");
  }

  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" aria-hidden />
        </div>
        <span className="font-heading text-base font-semibold text-foreground">OpsFlow</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const isActive = item.match ? item.match(pathname) : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-50 text-primary dark:bg-indigo-500/10"
                  : "text-muted hover:bg-slate-50 hover:text-foreground dark:hover:bg-white/5",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
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
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md -m-1.5 p-1.5 hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <Avatar name={user.email} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
              <p className="truncate text-xs text-muted">{user.role.replace(/_/g, " ")}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/5"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
