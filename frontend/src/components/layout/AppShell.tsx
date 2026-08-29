import { RequireSlackConnected } from "./RequireSlackConnected";
import { AppSidebar } from "./AppSidebar";

// The authenticated app frame — sidebar + scrollable content pane. Shared by
// the (protected) layout (which adds RequireAuth around it) and the root "/"
// page (which knows the visitor is authenticated some other way, so it skips
// straight to this shell instead of duplicating its markup).
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireSlackConnected>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-8 sm:py-10 md:pb-10">{children}</div>
        </main>
      </div>
    </RequireSlackConnected>
  );
}
