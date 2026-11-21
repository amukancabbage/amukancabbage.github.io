import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, Outlet, RouterProvider, useRouteError } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import AsyncState from './components/AsyncState';
import DraftGuard from './components/DraftGuard';
import Layout from './components/Layout';
import { menu, type MenuItem } from './menu';
import { ThemeProvider } from './theme';
import './App.css';
import './shell.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));

function SignInRoute() {
  const { session, loading } = useAuth();
  if (loading) return <AsyncState loading />;
  if (session) return <Navigate replace to="/beranda" />;
  return <Suspense fallback={<AsyncState loading />}><LoginPage /></Suspense>;
}

function AppRoutes() {
  const { session, profile, loading, signOut, refreshProfile, profileError } = useAuth();

  if (loading) return <div className="center" role="status">Memuat SISIDOS…</div>;
  if (!session) return <Suspense fallback={<AsyncState loading />}><LoginPage /></Suspense>;
  if (!profile) return (
    <main className="center">
      <AsyncState error={profileError || 'Profil akun belum tersedia. Hubungi administrator.'} onRetry={() => void refreshProfile()} />
      <button className="secondary" onClick={() => void signOut()}>Keluar</button>
    </main>
  );

  return <DraftGuard><Layout><Outlet /></Layout></DraftGuard>;
}

function RouteScreen({ item }: { item: MenuItem }) {
  const { profile } = useAuth();
  if (!profile || !item.roles.includes(profile.role)) return <Navigate replace to="/beranda" />;
  return <Suspense fallback={<AsyncState loading />}>{item.element}</Suspense>;
}

function RouteError() {
  const error = useRouteError();
  console.error(error);
  return (
    <AsyncState
      error="Halaman gagal dimuat."
      onRetry={() => window.location.reload()}
    />
  );
}

// Hash history mempertahankan permalink saat aplikasi disajikan dari hosting statis.
const router = createHashRouter([{
  errorElement: <RouteError />,
  children: [
    { path: '/', element: <Suspense fallback={<AsyncState loading />}><LandingPage /></Suspense> },
    { path: '/masuk', element: <SignInRoute /> },
    {
      element: <AppRoutes />,
      children: [
        ...menu.flatMap((group) => group.items.map((item) => ({
          path: item.path,
          element: <RouteScreen item={item} />,
          handle: { title: item.label, section: group.title, icon: item.icon },
          errorElement: <RouteError />,
        }))),
        { path: '*', element: <Navigate replace to="/beranda" /> },
      ],
    },
  ],
}]);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
