"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Building2, UserCog } from "lucide-react";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { clearPlatformToken } from "@/lib/api/platform-client";
import { PlatformProfileProvider, usePlatformProfile } from "./PlatformProfileContext";
import { Avatar } from "@/components/ui/Avatar";
import { CompactThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/platform", label: "Tenants", icon: Building2, exact: true },
  { href: "/platform/admins", label: "Admins", icon: UserCog, globalOnly: true },
];

function PlatformHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin } = usePlatformAuth();
  const { profile } = usePlatformProfile();

  function handleSignOut() {
    clearPlatformToken();
    router.push("/platform/login");
  }

  const items = NAV_ITEMS.filter((item) => !item.globalOnly || profile?.isGlobalAdmin);

  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-4 py-3 shadow-[var(--shadow-sm)] sm:gap-3 sm:px-8 sm:py-3.5">
      <Link href="/platform" className="flex shrink-0 items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="size-4" aria-hidden />
        </div>
        <span className="font-heading text-sm font-semibold text-foreground">OpsFlow</span>
      </Link>
      <span className="hidden shrink-0 rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20 sm:inline-block">
        Platform Admin
      </span>

      <nav className="flex items-center gap-1 sm:ml-6">
        {items.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-3",
                isActive
                  ? "bg-primary-tint text-primary"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <CompactThemeToggle />
        {admin && (
          <>
            <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <Link
              href="/platform/profile"
              title={profile?.name || admin.email}
              aria-label={`Profile: ${profile?.name || admin.email}`}
              className="rounded-full transition-opacity hover:opacity-80"
            >
              <Avatar name={profile?.name || admin.email} className="size-8 text-xs" />
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground sm:px-2.5"
            >
              <LogOut className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProfileProvider>
      <div className="min-h-screen bg-background">
        <PlatformHeader />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</main>
      </div>
    </PlatformProfileProvider>
  );
}
