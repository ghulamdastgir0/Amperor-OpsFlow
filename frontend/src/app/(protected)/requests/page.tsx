import { RequestsList } from "@/components/assistant/RequestsList";
import { PageHeader } from "@/components/ui/PageHeader";

export default function RequestsPage() {
  return (
    <div>
      <PageHeader
        title="Action Hub & In-Tray"
        description="Pending requests, attached Slack invoices/receipts, and their approval status."
      />
      <RequestsList />
    </div>
  );
}
