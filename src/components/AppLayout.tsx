import { ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Activity, LogOut, BarChart3, Calendar,
  ClipboardList, LayoutDashboard, AlertTriangle,
  TrendingUp, FileText, Settings, Menu,
} from 'lucide-react';

const athleteNav = [
  { path: '/dashboard', label: 'Dashboard', icon: Activity },
  { path: '/cycle-setup', label: 'Cycle', icon: Calendar },
  { path: '/plan', label: 'Training Plan', icon: ClipboardList },
  { path: '/risk-report', label: 'Risk', icon: BarChart3 },
];

const coachNav = [
  { path: '/coach', label: 'Squad Overview', icon: LayoutDashboard },
  { path: '/coach/escalations', label: 'Escalations', icon: AlertTriangle },
  { path: '/coach/analytics', label: 'Analytics', icon: TrendingUp },
  { path: '/coach/plans', label: 'Plans', icon: ClipboardList },
  { path: '/coach/reports', label: 'Reports', icon: FileText },
  { path: '/coach/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const items = profile?.role === 'coach' ? coachNav : athleteNav;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-3 sm:px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-1 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="font-heading text-base sm:text-lg font-bold uppercase tracking-wider">CycleAgent</span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block truncate max-w-[160px]">
            {profile?.full_name || profile?.email}
          </span>
          <ThemeToggle />
          <button onClick={handleSignOut} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Sign out">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — persistent */}
        <nav className="hidden md:flex flex-col w-56 border-r border-border p-4 gap-1 shrink-0">
          {items.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'border-2 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile slide-over drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle className="flex items-center gap-2 font-heading text-base uppercase tracking-wider">
                <Activity className="h-5 w-5 text-primary" />
                CycleAgent
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-3 py-2">
              {items.map(item => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'border-2 border-primary text-primary bg-primary/5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground truncate mb-2">{profile?.full_name || profile?.email}</p>
              <button
                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
