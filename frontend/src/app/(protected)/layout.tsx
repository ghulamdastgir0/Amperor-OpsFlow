import { RequireAuth } from "@/components/layout/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { RealtimeBridge } from "@/components/RealtimeBridge";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RealtimeBridge />
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
