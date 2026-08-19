"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Building2, UserCog } from "lucide-react";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { clearPlatformToken } from "@/lib/api/platform-client";
import { PlatformProfileProvider, usePlatformProfile } from "./PlatformProfileContext";
import { Avatar } from "@/components/ui/Avatar";
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
    <header className="flex items-center gap-3 border-b border-white/10 bg-slate-900 px-8 py-4">
      <Link href="/platform" className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-indigo-500">
          <ShieldCheck className="size-4 text-white" aria-hidden />
        </div>
        <span className="font-heading text-sm font-semibold text-white">OpsFlow</span>
      </Link>
      <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
        Platform Admin
      </span>

      <nav className="ml-6 flex items-center gap-1">
        {items.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {admin && (
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/platform/profile"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5"
          >
            <Avatar name={profile?.name || admin.email} className="size-6 text-[10px]" />
            <span className="text-sm text-slate-300">{profile?.name || admin.email}</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProfileProvider>
      <div className="min-h-screen bg-slate-950">
        <PlatformHeader />
        <main className="mx-auto max-w-6xl px-8 py-10">{children}</main>
      </div>
    </PlatformProfileProvider>
  );
}
