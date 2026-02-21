import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { Activity, User, LogOut, BarChart3, Calendar, Dumbbell, HeartPulse, ClipboardList, Shield } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Activity },
  { path: '/cycle-setup', label: 'Cycle', icon: Calendar },
  { path: '/training-log', label: 'Training', icon: Dumbbell },
  { path: '/soreness-log', label: 'Soreness', icon: HeartPulse },
  { path: '/plan', label: 'Plan', icon: ClipboardList },
  { path: '/risk-report', label: 'Risk', icon: BarChart3 },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const items = profile?.role === 'coach' 
    ? [{ path: '/coach', label: 'Athletes', icon: Shield }, ...navItems.slice(0, 1)]
    : navItems;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="font-heading text-lg font-bold uppercase tracking-wider">CycleAgent</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{profile?.full_name || profile?.email}</span>
          <button onClick={handleSignOut} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Sign out">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Side nav - desktop */}
        <nav className="hidden md:flex flex-col w-56 border-r border-border p-4 gap-1">
          {items.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active 
                    ? 'bg-primary/10 text-primary neon-border' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
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

      {/* Bottom nav - mobile */}
      <nav className="md:hidden border-t border-border flex justify-around py-2 bg-background">
        {items.slice(0, 5).map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
