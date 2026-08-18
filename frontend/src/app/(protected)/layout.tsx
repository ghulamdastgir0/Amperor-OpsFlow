import { RequireAuth } from "@/components/layout/RequireAuth";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
