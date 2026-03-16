import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProductsPage from './pages/ProductsPage'
import CostEarningPage from './pages/CostEarningPage'
import ImportPage from './pages/ImportPage'
import CatalogoPage from './pages/CatalogoPage'
import TrazabilidadPage from './pages/TrazabilidadPage'
import ActivityLogPage from './pages/ActivityLogPage'
import LoginPage from './pages/LoginPage'

const Nav = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="app__nav">
      <NavLink to="/import" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')}>
        Cargar inventario
      </NavLink>
      <NavLink to="/" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')} end>
        Bienes
      </NavLink>
      <NavLink to="/cost-earning" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')}>
        Valorización
      </NavLink>
      <NavLink to="/catalogo" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')}>
        Catálogo
      </NavLink>
      <NavLink to="/trazabilidad" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')}>
        Trazabilidad
      </NavLink>
      <NavLink to="/actividad" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')}>
        Historial de actividad
      </NavLink>
      <span className="app__nav-user">
        <span className="app__nav-role" title={user?.role === 'administrador' ? 'Administrador' : 'Colaborador'}>
          {user?.role === 'administrador' ? 'Admin' : 'Colab'}
        </span>
        <span className="app__nav-email">{user?.email}</span>
        <button type="button" className="app__nav-logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </span>
    </nav>
  )
}

const App = () => {
  const { isLoggedIn } = useAuth()

  if (!isLoggedIn) {
    return (
      <main className="app">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>Sistema de Gestión de Inventario</h1>
        <Nav />
      </header>
      <Routes>
        <Route path="/" element={<ProductsPage />} />
        <Route path="/cost-earning" element={<CostEarningPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/catalogo" element={<CatalogoPage />} />
        <Route path="/trazabilidad" element={<TrazabilidadPage />} />
         <Route path="/actividad" element={<ActivityLogPage />} />
        <Route path="/login" element={<Navigate to="/import" replace />} />
      </Routes>
    </main>
  )
}

export default App
