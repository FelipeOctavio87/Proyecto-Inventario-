import { Routes, Route, NavLink } from 'react-router-dom'
import ProductsPage from './pages/ProductsPage'
import CostEarningPage from './pages/CostEarningPage'

const Nav = () => (
  <nav className="app__nav">
    <NavLink to="/" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')} end>
      Productos
    </NavLink>
    <NavLink to="/cost-earning" className={({ isActive }) => (isActive ? 'app__nav-link app__nav-link--active' : 'app__nav-link')}>
      Costo y Ganancia
    </NavLink>
  </nav>
)

const App = () => (
  <main className="app">
    <header className="app__header">
      <h1>Sistema de Inventario</h1>
      <Nav />
    </header>
    <Routes>
      <Route path="/" element={<ProductsPage />} />
      <Route path="/cost-earning" element={<CostEarningPage />} />
    </Routes>
  </main>
)

export default App
