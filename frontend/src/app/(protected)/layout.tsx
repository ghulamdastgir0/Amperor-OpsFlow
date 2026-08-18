import { RequireAuth } from "@/components/layout/RequireAuth";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
        </main>
      </div>
    </RequireAuth>
  );
}
