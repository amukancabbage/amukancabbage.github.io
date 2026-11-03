import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import { menuFor } from './menu'
import LoginPage from './pages/LoginPage'
import './App.css'

function AppRoutes() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) return <p className="center">Memuat...</p>
  if (!session) return <LoginPage />
  if (!profile)
    return (
      <div className="center">
        <p>Profil akun tidak ditemukan. Pastikan supabase/auth.sql sudah dijalankan.</p>
        <button onClick={signOut}>Keluar</button>
      </div>
    )

  // hanya halaman yang boleh dibuka oleh role ini yang didaftarkan
  const items = menuFor(profile.role).flatMap((group) => group.items)

  return (
    <Layout>
      <Routes>
        {items.map((item) => (
          <Route key={item.path} path={item.path} element={item.element} />
        ))}
        <Route path="*" element={<Navigate to={items[0].path} replace />} />
      </Routes>
    </Layout>
  )
}

// HashRouter dipakai agar refresh halaman tidak 404 di GitHub Pages / Vercel
function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}

export default App
