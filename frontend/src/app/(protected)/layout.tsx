import { RequireAuth } from "@/components/layout/RequireAuth";
import { RequireSlackConnected } from "@/components/layout/RequireSlackConnected";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireSlackConnected>
        <div className="flex h-screen">
          <AppSidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
          </main>
        </div>
      </RequireSlackConnected>
    </RequireAuth>
  );
}
