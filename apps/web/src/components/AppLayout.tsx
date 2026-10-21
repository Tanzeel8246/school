import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap as GraduationCapIcon,
  Briefcase,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Receipt,
  BookOpen,
  ClipboardList,
  Library,
  Bus,
  Building2,
  Package,
  MessageSquare,
  FileBarChart,
  Home,
  CalendarCheck,
  School,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { RoleGate } from '@/components/RoleGate';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** When set, the item only renders if the user has this permission. */
  permission?: string;
}

interface NavSection {
  /** Optional section heading displayed in the sidebar. */
  heading?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    heading: 'People',
    items: [
      { to: '/students', label: 'Students', icon: Users, permission: 'students:read' },
      { to: '/teachers', label: 'Teachers', icon: GraduationCapIcon, permission: 'teachers:read' },
      { to: '/staff', label: 'Staff', icon: Briefcase, permission: 'staff:read' },
      { to: '/parent', label: 'Parent Portal', icon: Home, permission: 'parent:read' },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { to: '/fees', label: 'Fees', icon: Receipt, permission: 'fees:read' },
      { to: '/accounting', label: 'Accounting', icon: BookOpen, permission: 'accounting:read' },
      { to: '/payroll', label: 'Payroll', icon: Wallet, permission: 'payroll:read' },
    ],
  },
  {
    heading: 'Academics',
    items: [
      { to: '/exams', label: 'Exams', icon: ClipboardList, permission: 'results:read' },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck, permission: 'attendance:mark' },
      { to: '/academics', label: 'Academic Setup', icon: School, permission: 'academics:read' },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { to: '/library', label: 'Library', icon: Library, permission: 'library:read' },
      { to: '/transport', label: 'Transport', icon: Bus, permission: 'transport:read' },
      { to: '/hostel', label: 'Hostel', icon: Building2, permission: 'hostel:read' },
      { to: '/inventory', label: 'Inventory', icon: Package, permission: 'inventory:read' },
    ],
  },
  {
    heading: 'Communication',
    items: [
      { to: '/communications', label: 'Messages', icon: MessageSquare, permission: 'communications:read' },
    ],
  },
  {
    heading: 'Reports',
    items: [
      { to: '/reports', label: 'Reports & Export', icon: FileBarChart, permission: 'reports:read' },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { to: '/school-setup', label: 'School Setup', icon: Settings, permission: 'settings:manage' },
      { to: '/billing', label: 'Billing & Plan', icon: Receipt, permission: 'settings:manage' },
      { to: '/settings/security', label: 'Security (2FA)', icon: Shield },
    ],
  },
  {
    heading: 'Super Admin',
    items: [
      { to: '/schools', label: 'All Schools', icon: Building2, permission: 'schools:read' },
      { to: '/admin/requests', label: 'Subscription Requests', icon: Receipt, permission: 'schools:write' },
    ],
  },
];

/** Humanize a role slug, e.g. "super_admin" -> "Super Admin". */
function humanizeRole(role: string) {
  return role
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Responsive app shell: fixed sidebar on desktop, slide-in drawer on mobile.
 * Topbar shows role label, user name and a logout button.
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Sidebar content shared between the desktop rail and the mobile drawer.
  const SidebarBody = () => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-border/50 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">School ERP</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="space-y-0.5">
            {section.heading && (
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section.heading}
              </p>
            )}
            {section.items.map((item) => {
              const link = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              );

              return item.permission ? (
                <RoleGate key={item.to} permission={item.permission}>
                  {link}
                </RoleGate>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border/50 bg-card lg:block">
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-60 bg-card shadow-2xl animate-slide-up">
            <SidebarBody />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/50 bg-card/80 backdrop-blur-xl px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            {user && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                {humanizeRole(user.role)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
              {user?.name}
            </span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        {/* Routed page content */}
        <main key={location.pathname} className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
