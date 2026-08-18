import { RequireAuth } from "@/components/layout/RequireAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={["SYSTEM_ADMIN"]}>{children}</RequireAuth>;
}
