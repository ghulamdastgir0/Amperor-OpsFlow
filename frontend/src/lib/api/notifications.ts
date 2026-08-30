import { apiClient } from "./client";
import type { ApiEnvelope, AppNotification } from "../types";

export async function list(unreadOnly = false) {
  const { data } = await apiClient.get<ApiEnvelope<AppNotification[]>>("/notifications", {
    params: unreadOnly ? { unread: "true" } : undefined,
  });
  return data.data;
}

export async function markRead(id: string) {
  await apiClient.post(`/notifications/${id}/read`);
}

export async function markAllRead() {
  await apiClient.post("/notifications/read-all");
}
