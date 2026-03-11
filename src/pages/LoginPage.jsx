import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Introduce tu email.')
      return
    }
    if (!password) {
      setError('Introduce tu contraseña.')
      return
    }

    // MVP: autenticación simulada (sin backend)
    login(email.trim())
    navigate('/import', { replace: true })
  }

  return (
    <div className="page login-page">
      <section className="login">
        <div className="login__logo-wrap">
          <img src="/logo.png" alt="Inventario - Sistema de Control" className="login__logo" />
        </div>
        <h2 className="login__title">Iniciar sesión</h2>
        <form className="login__form" onSubmit={handleSubmit}>
          {error && <p className="login__error" role="alert">{error}</p>}
          <label className="login__label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            className="login__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
          />
          <label className="login__label" htmlFor="login-password">
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            className="login__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button type="submit" className="login__submit">
            Entrar
          </button>
        </form>
        <p className="login__hint">MVP: cualquier email y contraseña simulan el acceso.</p>
      </section>
    </div>
  )
}

export default LoginPage
