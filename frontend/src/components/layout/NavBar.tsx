"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { clearAuthToken } from "@/lib/api";

export function NavBar() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const links = [
    { href: "/assistant", label: "Assistant" },
    { href: "/requests", label: "Requests" },
    ...(user?.role === "SYSTEM_ADMIN"
      ? [{ href: "/admin/delegations", label: "Finance Delegations" }]
      : []),
  ];

  function handleSignOut() {
    clearAuthToken();
    router.push("/login");
  }

  return (
    <header className="border-b border-black/10 dark:border-white/10 px-6 py-3 flex items-center gap-6">
      <Link href="/" className="font-semibold">
        AI Corporate Operations Agent
      </Link>
      {isAuthenticated && (
        <nav className="flex gap-4 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="ml-auto text-sm flex items-center gap-3">
        {isAuthenticated && user ? (
          <>
            <span className="opacity-60">{user.email}</span>
            <button type="button" onClick={handleSignOut} className="hover:underline">
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className="hover:underline">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
