import { ChatCanvas } from "@/components/assistant/ChatCanvas";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AssistantPage() {
  return (
    <div>
      <PageHeader
        title="Assistant"
        description="Conversational Command Canvas — multi-turn dialogue with real-time state tracking."
      />
      <ChatCanvas />
    </div>
  );
}
