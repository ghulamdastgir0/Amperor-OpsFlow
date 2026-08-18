import { RequirePlatformAuth } from "@/components/platform/RequirePlatformAuth";
import { PlatformShell } from "@/components/platform/PlatformShell";

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePlatformAuth>
      <PlatformShell>{children}</PlatformShell>
    </RequirePlatformAuth>
  );
}
