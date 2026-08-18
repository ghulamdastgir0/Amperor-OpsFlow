"use client";

import { useSyncExternalStore } from "react";
import { PLATFORM_AUTH_CHANGE_EVENT, PLATFORM_TOKEN_KEY } from "@/lib/api/platform-client";
import { getStoredPlatformAdmin, type StoredPlatformAdmin } from "@/lib/platform-auth";

let cachedToken: string | null = null;
let cachedAdmin: StoredPlatformAdmin | null = null;

function getSnapshot(): StoredPlatformAdmin | null {
  const token = window.localStorage.getItem(PLATFORM_TOKEN_KEY);
  if (token !== cachedToken) {
    cachedToken = token;
    cachedAdmin = getStoredPlatformAdmin();
  }
  return cachedAdmin;
}

function getServerSnapshot(): StoredPlatformAdmin | null {
  return null;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PLATFORM_AUTH_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PLATFORM_AUTH_CHANGE_EVENT, onStoreChange);
  };
}

export function usePlatformAuth() {
  const admin = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { admin, isAuthenticated: !!admin, isLoading: false };
}
