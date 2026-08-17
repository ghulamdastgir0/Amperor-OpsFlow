import { ChatCanvas } from "@/components/assistant/ChatCanvas";

export default function AssistantPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-xl font-semibold mb-1">Assistant</h1>
      <p className="text-sm opacity-70 mb-6">
        Conversational Command Canvas — multi-turn dialogue with real-time state tracking.
      </p>
      <ChatCanvas />
    </div>
  );
}
