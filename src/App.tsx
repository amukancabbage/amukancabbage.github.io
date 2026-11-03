import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { menu } from './menu'
import './App.css'

const items = menu.flatMap((group) => group.items)

// HashRouter dipakai agar refresh halaman tidak 404 di GitHub Pages / Vercel
function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to={items[0].path} replace />} />
          {items.map((item) => (
            <Route key={item.path} path={item.path} element={item.element} />
          ))}
        </Routes>
      </Layout>
    </HashRouter>
  )
}

export default App
