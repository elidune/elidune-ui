import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LibraryProvider } from '@/contexts/LibraryContext';
import { Layout } from '@/components/common';
import {
  FirstSetupPage,
  MaintenancePage,
  LoginPage,
  MustChangePasswordPage,
  HomePage,
  BibliosPage,
  BiblioDetailPage,
  BiblioEditPage,
  BiblioCreatePage,
  InventoryPage,
  UsersPage,
  UserDetailPage,
  MyLoansPage,
  LoansPage,
  HoldsPage,
  StatsPage,
  SettingsPage,
  Z3950SearchPage,
  ProfilePage,
  ImportIsoPage,
  EventsPage,
  LibraryPage,
  AboutPage,
  PrivacyPage,
} from '@/pages';
import { isLibrarian, isAdmin } from '@/types';
import { FirstSetupGate } from '@/components/first-setup/FirstSetupGate';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function LibrarianRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!isLibrarian(user?.accountType)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!isAdmin(user?.accountType)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/first-setup" element={<FirstSetupPage />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<MustChangePasswordPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/biblios"
        element={
          <ProtectedRoute>
            <BibliosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/biblios/new"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <BiblioCreatePage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/biblios/:id/edit"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <BiblioEditPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/biblios/:id"
        element={
          <ProtectedRoute>
            <BiblioDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <InventoryPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-loans"
        element={
          <ProtectedRoute>
            <MyLoansPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/loans"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <LoansPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/holds"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <HoldsPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <UsersPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users/:id"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <UserDetailPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/stats"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <StatsPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <SettingsPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/z3950"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <Z3950SearchPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/import-iso"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <ImportIsoPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <EventsPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <LibrarianRoute>
              <LibraryPage />
            </LibrarianRoute>
          </ProtectedRoute>
        }
      />

      <Route path="/about" element={<AboutPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <LibraryProvider>
            <LanguageProvider>
              <BrowserRouter>
                <FirstSetupGate>
                  <AppRoutes />
                </FirstSetupGate>
              </BrowserRouter>
            </LanguageProvider>
          </LibraryProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
