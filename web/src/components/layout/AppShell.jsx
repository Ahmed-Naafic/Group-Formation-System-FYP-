import { useState } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useNotificationSocket } from '@/features/notification/useNotificationSocket';

/**
 * Main authenticated layout: fixed sidebar + scrollable content area.
 * Each route may export a `handle.title` string for the topbar.
 */
export default function AppShell() {
  useNotificationSocket();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Read the page title from the nearest route's handle.title
  const matches = useMatches();
  const title   = [...matches].reverse().find((m) => m.handle?.title)?.handle?.title
    ?? 'Dashboard';

  return (
    // No overflow-x here (moved to html/body in index.css) — an inner wrapper
    // with overflow-x-hidden but no overflow-y set would make that wrapper
    // its own scroll container per the CSS overflow spec, breaking the
    // topbar's `sticky top-0` against real document scroll.
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content — offset by sidebar width on desktop */}
      <div className="flex flex-1 min-w-0 flex-col lg:pl-60">
        <Topbar
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
        />
        {/* Topbar is now `fixed` (removed from flow) — this reserves its
            height so main content doesn't render underneath it. */}
        <div className="h-14 shrink-0" aria-hidden="true" />

        <main className="flex-1 min-w-0 p-4 sm:p-6 bg-ink-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
