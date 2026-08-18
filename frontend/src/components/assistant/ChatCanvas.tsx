"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, Bot, Send, Sparkles } from "lucide-react";
import { assistantApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { Message } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

const SUGGESTIONS = ["Submit an expense", "Check my department's budget", "Request time off"];

export function ChatCanvas() {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(content: string) {
    if (!content.trim()) return;
    setError(null);
    setIsSending(true);
    try {
      const result = await assistantApi.sendMessage(content, conversationId);
      setConversationId(result.conversation.id);
      setMessages((prev) => [...prev, ...result.messages]);
      setInput("");
    } catch {
      setError("Could not reach the Assistant. Is the backend running?");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  return (
    <div className="flex h-[65vh] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-indigo-50 text-primary">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">
                Ask the Assistant to submit a request
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                e.g. &quot;Please reimburse this $450 flight invoice.&quot;
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "USER";
          return (
            <div key={message.id} className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
              {isUser ? (
                <Avatar name={user?.email ?? "You"} className="mb-0.5" />
              ) : (
                <span className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                  <Bot className="size-4" aria-hidden />
                </span>
              )}
              <div
                className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                  isUser
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm border border-border bg-slate-50 text-foreground"
                }`}
              >
                {message.content}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-end gap-2.5">
            <span className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <Bot className="size-4" aria-hidden />
            </span>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-slate-50 px-4 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
        <input
          className="flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Message the Assistant…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" isLoading={isSending} disabled={!input.trim()}>
          {!isSending && <Send className="size-4" aria-hidden />}
          Send
        </Button>
      </form>
    </div>
  );
}
