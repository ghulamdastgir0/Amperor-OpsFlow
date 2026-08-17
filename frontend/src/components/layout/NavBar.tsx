import Link from "next/link";

const links = [
  { href: "/assistant", label: "Assistant" },
  { href: "/requests", label: "Requests" },
  { href: "/admin/delegations", label: "Finance Delegations" },
];

export function NavBar() {
  return (
    <header className="border-b border-black/10 dark:border-white/10 px-6 py-3 flex items-center gap-6">
      <Link href="/" className="font-semibold">
        AI Corporate Operations Agent
      </Link>
      <nav className="flex gap-4 text-sm">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:underline">
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto text-sm">
        <Link href="/login" className="hover:underline">
          Sign in
        </Link>
      </div>
    </header>
  );
}
