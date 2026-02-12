import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Layout } from '@/components/common';
import {
  LoginPage,
  HomePage,
  ItemsPage,
  ItemDetailPage,
  UsersPage,
  UserDetailPage,
  MyLoansPage,
  LoansPage,
  StatsPage,
  SettingsPage,
  Z3950SearchPage,
  ProfilePage,
  ImportIsoPage,
} from '@/pages';
import { isLibrarian, isAdmin } from '@/types';

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

  if (!isLibrarian(user?.account_type)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!isAdmin(user?.account_type)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/items"
        element={
          <ProtectedRoute>
            <ItemsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/items/:id"
        element={
          <ProtectedRoute>
            <ItemDetailPage />
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <LanguageProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
