"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { useRealtimeEvent } from "@/hooks/useRealtime";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/cn";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// `placement="up"` opens the panel above the trigger — used inside the mobile
// "More" bottom sheet, where a downward panel would be off-screen.
export function NotificationBell({ placement = "down" }: { placement?: "up" | "down" }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notificationsApi
      .list()
      .then(setItems)
      .catch(() => {});
  }, []);

  useRealtimeEvent<AppNotification>("notification.new", (n) => {
    setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, 30)));
  });

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((n) => !n.readAt).length;

  async function markAll() {
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      /* best-effort */
    }
  }

  function openItem(n: AppNotification) {
    if (!n.readAt) {
      setItems((prev) =>
        prev.map((p) => (p.id === n.id ? { ...p, readAt: new Date().toISOString() } : p)),
      );
      notificationsApi.markRead(n.id).catch(() => {});
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        className="relative rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)]",
            placement === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
              >
                <Check className="size-3" aria-hidden /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-sm text-muted">Nothing yet</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const body = (
                    <div
                      className={cn(
                        "flex flex-col gap-0.5 px-3.5 py-2.5 transition-colors hover:bg-surface-2",
                        !n.readAt && "border-l-2 border-l-primary",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{n.title}</span>
                        <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                      </div>
                      <span className="line-clamp-2 text-xs text-muted">{n.body}</span>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.requestId ? (
                        <Link href={`/requests/${n.requestId}`} onClick={() => openItem(n)}>
                          {body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => openItem(n)}
                        >
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
