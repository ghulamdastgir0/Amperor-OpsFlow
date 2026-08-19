"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

// True only once we're definitely running on the client past hydration. Uses the
// same getSnapshot/getServerSnapshot split as useAuth/usePlatformAuth so this flips
// to true on the exact same resync pass that those hooks resolve to their real
// client value — see RequireAuth/RequirePlatformAuth for why that matters.
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
