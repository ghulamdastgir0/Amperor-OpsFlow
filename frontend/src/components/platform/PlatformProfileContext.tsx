"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { platformApi } from "@/lib/api";
import type { PlatformAdminProfile } from "@/lib/types";

interface PlatformProfileValue {
  profile: PlatformAdminProfile | null;
  isLoading: boolean;
  refresh: () => void;
}

const PlatformProfileContext = createContext<PlatformProfileValue | null>(null);

export function PlatformProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PlatformAdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .getMyProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  function refresh() {
    setIsLoading(true);
    setVersion((v) => v + 1);
  }

  return (
    <PlatformProfileContext.Provider value={{ profile, isLoading, refresh }}>
      {children}
    </PlatformProfileContext.Provider>
  );
}

export function usePlatformProfile() {
  const ctx = useContext(PlatformProfileContext);
  if (!ctx) throw new Error("usePlatformProfile must be used within PlatformProfileProvider");
  return ctx;
}
