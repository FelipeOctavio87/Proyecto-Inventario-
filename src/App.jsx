import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProductsPage from './pages/ProductsPage'
import CostEarningPage from './pages/CostEarningPage'
import ImportPage from './pages/ImportPage'
import LoginPage from './pages/LoginPage'

const Nav = () => {
  const { isLoggedIn, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="app__nav">
      <NavLink to="/" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')} end>
        Bienes
      </NavLink>
      <NavLink to="/cost-earning" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')}>
        Valorización
      </NavLink>
      <NavLink to="/import" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')}>
        Cargar inventario
      </NavLink>
      {isLoggedIn ? (
        <span className="app__nav-user">
          <span className="app__nav-email">{user?.email}</span>
          <button type="button" className="app__nav-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </span>
      ) : (
        <NavLink to="/login" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')}>
          Iniciar sesión
        </NavLink>
      )}
    </nav>
  )
}

const App = () => (
  <main className="app">
    <header className="app__header">
      <h1>Inventario de Bienes – SLEP Litoral</h1>
      <Nav />
    </header>
    <Routes>
      <Route path="/" element={<ProductsPage />} />
      <Route path="/cost-earning" element={<CostEarningPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  </main>
)

export default App
