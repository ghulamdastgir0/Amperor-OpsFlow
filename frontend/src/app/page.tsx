"use client";

import { useAuth } from "@/hooks/useAuth";
import { useHasMounted } from "@/hooks/useHasMounted";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { LandingContent } from "@/components/marketing/LandingContent";

// "/" is a smart root, not a fixed public/protected route: signed-out
// visitors get the marketing landing page, signed-in users get the
// dashboard — same URL either way, so a bookmark or shared link always
// makes sense regardless of session state. Every other route stays behind
// RequireAuth's redirect-to-/login as before; this is the one deliberate
// exception, which is why it renders the auth check inline instead of
// living in the (protected) group.
export default function RootPage() {
  const { isAuthenticated } = useAuth();
  const hasMounted = useHasMounted();

  // Default to the landing page during the pre-hydration gap: it's static
  // marketing content anyone can see, so there's nothing to leak by showing
  // it for the instant before we know whether this visitor is signed in —
  // unlike RequireAuth's own gap, which guards actual tenant data.
  if (!hasMounted || !isAuthenticated) {
    return <LandingContent />;
  }

  return (
    <AppShell>
      <DashboardHome />
    </AppShell>
  );
}
