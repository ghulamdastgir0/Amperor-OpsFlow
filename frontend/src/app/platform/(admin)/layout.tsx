import { RequirePlatformAuth } from "@/components/platform/RequirePlatformAuth";

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return <RequirePlatformAuth>{children}</RequirePlatformAuth>;
}
