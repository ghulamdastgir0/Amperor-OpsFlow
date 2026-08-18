import { RequestsList } from "@/components/assistant/RequestsList";

export default function RequestsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-xl font-semibold mb-1">Action Hub &amp; In-Tray</h1>
      <p className="text-sm opacity-70 mb-6">
        Pending requests, attached Slack invoices/receipts, and their approval status.
      </p>
      <RequestsList />
    </div>
  );
}
