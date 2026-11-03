import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import DosenPage from './pages/DosenPage'
import ProdiPage from './pages/ProdiPage'
import './App.css'

// HashRouter dipakai agar refresh halaman tidak 404 di GitHub Pages
function App() {
  return (
    <HashRouter>
      <nav className="nav">
        <strong>Sistem Akademik</strong>
        <NavLink to="/dosen">Dosen</NavLink>
        <NavLink to="/prodi">Prodi</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/dosen" replace />} />
          <Route path="/dosen" element={<DosenPage />} />
          <Route path="/prodi" element={<ProdiPage />} />
        </Routes>
      </main>
    </HashRouter>
  )
}

export default App
