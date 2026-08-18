import { RequireAuth } from "@/components/layout/RequireAuth";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={["SYSTEM_ADMIN", "FINANCE_APPROVER", "DEPARTMENT_MANAGER", "TEAM_LEAD"]}>
      {children}
    </RequireAuth>
  );
}
