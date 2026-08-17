import Link from "next/link";

const sections = [
  {
    href: "/assistant",
    title: "Assistant Interface",
    description: "Conversational Command Canvas, Live Execution Timeline, and Policy Citation Viewer.",
  },
  {
    href: "/requests",
    title: "Action Hub & In-Tray",
    description: "Review pending requests, inspect attached Slack invoices/receipts, and take action.",
  },
  {
    href: "/admin/delegations",
    title: "Finance Manager Delegation",
    description: "Grant, delegate, or time-bound Finance Approval authority to Managers and Leads.",
  },
];

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">AI Corporate Operations Agent</h1>
        <p className="text-sm opacity-70 mt-1">
          Enterprise Autonomous Workflow Orchestration &amp; Exception Resolution Engine
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="border border-black/10 dark:border-white/10 rounded-lg p-4 hover:border-black/30 dark:hover:border-white/30 transition-colors"
          >
            <h2 className="font-medium">{section.title}</h2>
            <p className="text-sm opacity-70 mt-2">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
