import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { usePagination } from '../hooks/usePagination'
import { useInventory } from '../context/InventoryContext'
import { TIPO_BIEN, ESTADO_VERIFICACION } from '../types/product'
import FichaTecnicaModal from './FichaTecnicaModal'
import AddProductModal from './AddProductModal'

const formatCLP = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value ?? 0)

const ProductList = () => {
  const { products, loading } = useProducts()
  const { updateProduct } = useInventory()
  const [query, setQuery] = useState('')
  const [tipoBien, setTipoBien] = useState('')
  const [estadoVerificacion, setEstadoVerificacion] = useState('')

  const normalizeSkuForSearch = (value) => String(value ?? '').trim().replace(/\.0+$/, '')

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hasQuery = q.length > 0
    const qSku = normalizeSkuForSearch(q).toLowerCase()

    return products.filter((p) => {
      if (tipoBien && p.tipoBien !== tipoBien) return false
      if (estadoVerificacion && p.estadoVerificacion !== estadoVerificacion) return false

      if (!hasQuery) return true

      const codigo = normalizeSkuForSearch(p.codigoInventario ?? p.sku ?? '')
      const barcode = normalizeSkuForSearch(p.barcode ?? '')
      const name = String(p.name ?? '').toLowerCase()
      const description = String(p.description ?? '').toLowerCase()

      return (
        codigo.toLowerCase().includes(qSku) ||
        barcode.toLowerCase().includes(qSku) ||
        name.includes(q) ||
        description.includes(q)
      )
    })
  }, [products, query, tipoBien, estadoVerificacion])

  const {
    pageItems,
    currentPage,
    totalPages,
    totalCount,
    prevPage,
    nextPage,
    from,
    to,
  } = usePagination(filteredProducts)
  const [fichaProduct, setFichaProduct] = useState(null)
  const [showAddProduct, setShowAddProduct] = useState(false)

  if (loading) {
    return <p className="product-list__loading">Cargando bienes...</p>
  }

  if (totalCount === 0) {
    const hasFilters = query.trim().length > 0 || !!tipoBien || !!estadoVerificacion

    return (
      <section className="product-list">
        <h2 className="product-list__title">Inventario de bienes</h2>
        <div className="product-list__empty" role="status">
          {products.length === 0 && !hasFilters ? (
            <>
              <p className="product-list__empty-text">
                No hay bienes cargados. Puedes añadir ítems individuales aquí o cargar un CSV (solo Administrador) en
                <strong> Cargar inventario</strong>.
              </p>
              <div className="product-list__empty-actions">
                <button type="button" className="import__btn" onClick={() => setShowAddProduct(true)}>
                  Añadir ítem
                </button>
                <Link to="/import" className="product-list__empty-link">Ir a Cargar inventario</Link>
              </div>
            </>
          ) : (
            <>
              <p className="product-list__empty-text">
                No hay resultados para los filtros actuales.
              </p>
              <div className="product-list__empty-actions">
                <button
                  type="button"
                  className="import__btn"
                  onClick={() => {
                    setQuery('')
                    setTipoBien('')
                    setEstadoVerificacion('')
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
            </>
          )}
        </div>
        {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} />}
      </section>
    )
  }

  return (
    <section className="product-list">
      <div className="product-list__header">
        <h2 className="product-list__title">Inventario de bienes</h2>
        <button type="button" className="import__btn product-list__add-btn" onClick={() => setShowAddProduct(true)}>
          Añadir ítem
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-slate-600 bg-slate-800/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label className="block text-xs text-slate-300 mb-1" htmlFor="bienes-search">
              Búsqueda (SKU/código o nombre)
            </label>
            <input
              id="bienes-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej. 8000008164911 o 'Escritorio'"
              className="w-full rounded border border-slate-500 bg-slate-900/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Tipo de bien</label>
              <select
                value={tipoBien}
                onChange={(e) => setTipoBien(e.target.value)}
                className="product-list__estado-select"
              >
                <option value="">Todos</option>
                {Object.entries(TIPO_BIEN).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Estado verificación</label>
              <select
                value={estadoVerificacion}
                onChange={(e) => setEstadoVerificacion(e.target.value)}
                className="product-list__estado-select"
              >
                <option value="">Todos</option>
                {Object.entries(ESTADO_VERIFICACION).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="import__btn import__btn--secondary"
              onClick={() => {
                setQuery('')
                setTipoBien('')
                setEstadoVerificacion('')
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <p className="product-list__pagination-info">
        Mostrando {from}-{to} de {totalCount} bienes
      </p>
      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código inventario</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Valor en libros</th>
              <th>Estado verificación</th>
              <th>Ficha técnica</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.codigoInventario ?? product.sku}</td>
                <td>{TIPO_BIEN[product.tipoBien] ?? product.tipoBien}</td>
                <td>{product.description}</td>
                <td>{product.quantity}</td>
                <td>{formatCLP(product.valorLibros)}</td>
                <td>
                  <select
                    className="product-list__estado-select"
                    value={product.estadoVerificacion ?? 'teorico'}
                    onChange={(e) => updateProduct(product.id, { estadoVerificacion: e.target.value })}
                    aria-label={`Actualizar estado de ${product.name}`}
                  >
                    {Object.entries(ESTADO_VERIFICACION).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="product-list__ficha-btn"
                    onClick={() => setFichaProduct(product)}
                  >
                    Ver ficha
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Paginación">
          <button type="button" className="pagination__btn" onClick={prevPage} disabled={currentPage <= 1}>
            Anterior
          </button>
          <span className="pagination__text">
            Página {currentPage} de {totalPages}
          </span>
          <button type="button" className="pagination__btn" onClick={nextPage} disabled={currentPage >= totalPages}>
            Siguiente
          </button>
        </nav>
      )}
      {fichaProduct && (
        <FichaTecnicaModal product={fichaProduct} onClose={() => setFichaProduct(null)} />
      )}
      {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} />}
    </section>
  )
}

export default ProductList
