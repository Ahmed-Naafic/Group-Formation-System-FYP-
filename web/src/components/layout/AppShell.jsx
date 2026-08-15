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
    // overflow-y is pinned to `visible` alongside overflow-x-hidden: setting
    // only overflow-x per the CSS spec silently computes overflow-y to
    // `auto`, which would make this div (or `main` below) its own scroll
    // container and break the topbar's `sticky top-0` against real page
    // scroll. Keeping overflow-y visible keeps the document/body as the one
    // and only scrolling element, same as before.
    <div className="flex min-h-screen w-full overflow-x-hidden overflow-y-visible bg-background">
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

        <main className="flex-1 min-w-0 p-4 sm:p-6 bg-ink-50 overflow-x-hidden overflow-y-visible">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
