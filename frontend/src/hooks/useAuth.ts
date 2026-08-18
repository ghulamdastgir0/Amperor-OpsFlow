"use client";

import { useSyncExternalStore } from "react";
import { AUTH_CHANGE_EVENT, AUTH_TOKEN_KEY } from "@/lib/api/client";
import { getStoredUser, type StoredUser } from "@/lib/auth";

let cachedToken: string | null = null;
let cachedUser: StoredUser | null = null;

function getSnapshot(): StoredUser | null {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (token !== cachedToken) {
    cachedToken = token;
    cachedUser = getStoredUser();
  }
  return cachedUser;
}

function getServerSnapshot(): StoredUser | null {
  return null;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(AUTH_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(AUTH_CHANGE_EVENT, onStoreChange);
  };
}

export function useAuth() {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { user, isAuthenticated: !!user, isLoading: false };
}
