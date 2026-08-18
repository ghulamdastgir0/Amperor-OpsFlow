"use client";

import { useSyncExternalStore } from "react";

// Reads a query param without needing a Suspense boundary (unlike next/navigation's
// useSearchParams). These are one-shot landing-page reads, so no subscription is needed.
function subscribe() {
  return () => {};
}

function getServerSnapshot(): string | null {
  return null;
}

export function useQueryParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    getServerSnapshot,
  );
}
