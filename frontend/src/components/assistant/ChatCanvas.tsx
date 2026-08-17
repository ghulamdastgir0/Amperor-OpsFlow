"use client";

import { useState, type FormEvent } from "react";
import { assistantApi } from "@/lib/api";
import type { Message } from "@/lib/types";

export function ChatCanvas() {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    setError(null);
    setIsSending(true);
    try {
      const result = await assistantApi.sendMessage(input, conversationId);
      setConversationId(result.conversation.id);
      setMessages((prev) => [...prev, ...result.messages]);
      setInput("");
    } catch {
      setError("Could not reach the Assistant. Is the backend running?");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[60vh] border border-black/10 dark:border-white/10 rounded-lg">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-sm opacity-60">
            Ask the Assistant to submit a request, e.g. &quot;Please reimburse this $450 flight
            invoice.&quot;
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              message.role === "USER"
                ? "self-end bg-foreground text-background"
                : "self-start bg-black/5 dark:bg-white/10"
            }`}
          >
            {message.content}
          </div>
        ))}
      </div>
      {error && <p className="px-4 text-sm text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-black/10 dark:border-white/10">
        <input
          className="flex-1 border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent text-sm"
          placeholder="Message the Assistant…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={isSending}
          className="rounded bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
