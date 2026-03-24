import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  BookMarked,
  Sun,
  Moon,
  Monitor,
  Globe,
  Upload,
  ArrowLeftRight,
  CalendarDays,
  LibraryBig,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { isLibrarian, isAdmin } from '@/types';
import api from '@/services/api';
import { version as uiVersion } from '../../../package.json';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { libraryName } = useLibrary();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api.getHealth()
      .then((data) => setServerVersion(data.version ?? null))
      .catch(() => setServerVersion(null));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: t('nav.home'), href: '/', icon: Home, show: true },
    { name: t('nav.catalog'), href: '/biblios', icon: BookOpen, show: true },
    { name: t('nav.inventory'), href: '/inventory', icon: ClipboardList, show: isLibrarian(user?.account_type) },
    { name: t('nav.myLoans'), href: '/my-loans', icon: BookMarked, show: true },
    { name: t('nav.loans'), href: '/loans', icon: ArrowLeftRight, show: isLibrarian(user?.account_type) },
    { name: t('nav.users'), href: '/users', icon: Users, show: isLibrarian(user?.account_type) },
    { name: t('nav.z3950Search'), href: '/z3950', icon: Globe, show: isLibrarian(user?.account_type) },
    { name: t('nav.importIso'), href: '/import-iso', icon: Upload, show: isLibrarian(user?.account_type) },
    { name: t('nav.events'), href: '/events', icon: CalendarDays, show: isLibrarian(user?.account_type) },
    { name: t('nav.stats'), href: '/stats', icon: BarChart3, show: isLibrarian(user?.account_type) },
    { name: t('nav.library'), href: '/library', icon: LibraryBig, show: isLibrarian(user?.account_type) },
    { name: t('nav.settings'), href: '/settings', icon: Settings, show: isAdmin(user?.account_type) },
  ].filter(item => item.show);

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: t('theme.light') },
    { value: 'dark' as const, icon: Moon, label: t('theme.dark') },
    { value: 'system' as const, icon: Monitor, label: t('theme.system') },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="relative flex flex-col items-center justify-center py-4 px-4 border-b border-gray-200 dark:border-gray-800">
            <Link to="/" className="flex flex-col items-center gap-1.5">
              <img src="/elidune_logo.png" alt="Elidune" className="h-12 w-12" />
              <span className="text-sm font-semibold text-center text-gray-900 dark:text-white leading-tight">
                {libraryName ?? 'Elidune'}
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden absolute right-3 top-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Theme selector */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    theme === option.value
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <option.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User info */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 flex-1 min-w-0 p-2 -m-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={t('nav.profile')}
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {user?.firstname?.[0] || user?.username?.[0] || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user?.firstname} {user?.lastname}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.account_type}
                  </p>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
                title={t('nav.logout')}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-3 ml-4">
            <img src="/elidune_logo.png" alt="Elidune" className="h-8 w-8" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">{libraryName ?? 'Elidune'}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-800 py-3 px-4 lg:px-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
          <span className="font-mono">UI v{uiVersion}</span>
          <span className="font-mono">Server v{serverVersion ?? '—'}</span>
          <span className="flex-1" />
          <Link
            to="/about"
            className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {t('nav.about')}
          </Link>
          <Link
            to="/privacy"
            className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {t('nav.privacy')}
          </Link>
        </footer>
      </div>
    </div>
  );
}

