import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  LayoutDashboard, Building2, Layers, BookOpen,
  CalendarDays, Calendar, Users, SlidersHorizontal,
  X, Users2, ShieldAlert, FileBarChart, GraduationCap, BookMarked,
} from 'lucide-react';
import { selectRole } from '@/features/auth/authSlice';
import { cn } from '@/lib/utils';

const ADMIN_NAV = [
  { type: 'link',    label: 'Dashboard',        icon: LayoutDashboard, to: '/' },
  { type: 'section', label: 'Academic Structure' },
  { type: 'link',    label: 'Faculties',         icon: Building2,         to: '/faculties' },
  { type: 'link',    label: 'Departments',        icon: Layers,            to: '/departments' },
  { type: 'link',    label: 'Courses',            icon: BookOpen,          to: '/courses' },
  { type: 'link',    label: 'Academic Years',     icon: CalendarDays,      to: '/academic-years' },
  { type: 'link',    label: 'Semesters',          icon: Calendar,          to: '/semesters' },
  { type: 'section', label: 'Operations' },
  { type: 'link',    label: 'Cohorts',            icon: GraduationCap,     to: '/cohorts' },
  { type: 'link',    label: 'Course Offerings',   icon: BookMarked,        to: '/course-offerings' },
  { type: 'section', label: 'Users' },
  { type: 'link',    label: 'User Management',    icon: Users,             to: '/users' },
  { type: 'section', label: 'Settings' },
  { type: 'link',    label: 'Performance',        icon: SlidersHorizontal, to: '/settings/performance' },
  { type: 'link',    label: 'Reports',            icon: FileBarChart,      to: '/reports' },
  { type: 'link',    label: 'Audit Log',          icon: ShieldAlert,       to: '/audit' },
];

const INSTRUCTOR_NAV = [
  { type: 'link', label: 'Dashboard',       icon: LayoutDashboard,   to: '/' },
  { type: 'link', label: 'My Offerings',    icon: BookMarked,        to: '/course-offerings' },
  { type: 'link', label: 'Reports',         icon: FileBarChart,      to: '/reports' },
  { type: 'link', label: 'Performance',     icon: SlidersHorizontal, to: '/settings/performance' },
];

const STUDENT_NAV = [
  { type: 'link', label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { type: 'link', label: 'My Groups', icon: Users2,           to: '/workspaces' },
];

export default function Sidebar({ isOpen, onClose }) {
  const role = useSelector(selectRole);
  const nav  = role === 'admin' ? ADMIN_NAV : role === 'student' ? STUDENT_NAV : INSTRUCTOR_NAV;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-20 bg-ink-900/40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-30 flex h-full w-60 flex-col',
          'transition-transform duration-[200ms]',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* ── Logo ────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-5 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md shadow-sm" style={{ background: '#ffffff' }}>
            <img src="/logo-just.png" alt="JUST" className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold leading-none" style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem' }}>
              JUST
            </p>
            <p className="truncate leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--fs-micro)' }}>
              Group Formation
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:text-white lg:hidden transition-colors"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Nav ─────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3">
          {nav.map((item, i) => {
            if (item.type === 'section') {
              return (
                <p
                  key={i}
                  className="mt-5 mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  {item.label}
                </p>
              );
            }

            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium mb-0.5',
                    'transition-all duration-[150ms]',
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )
                }
                onClick={() => { if (window.innerWidth < 1024) onClose(); }}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className="absolute left-0 h-5 w-0.5 rounded-r"
                      style={{
                        background: isActive ? 'var(--just-gold-400)' : 'transparent',
                        marginLeft: '-0.75rem',
                      }}
                    />
                    <Icon size={17} strokeWidth={1.75} className="shrink-0" />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Role badge ───────────────────────────────────── */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
            style={{
              background: role === 'admin' ? 'rgba(232,197,71,0.20)' : 'rgba(18,138,71,0.25)',
              color: role === 'admin' ? 'var(--just-gold-300)' : 'var(--just-green-200)',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: role === 'admin' ? 'var(--just-gold-400)' : 'var(--just-green-400)' }}
            />
            {role}
          </span>
        </div>
      </aside>
    </>
  );
}
