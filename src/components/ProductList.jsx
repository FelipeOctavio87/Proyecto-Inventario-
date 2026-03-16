import { useState } from 'react'
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
  const { pageItems, currentPage, totalPages, totalCount, prevPage, nextPage, from, to } = usePagination(products)
  const [fichaProduct, setFichaProduct] = useState(null)
  const [showAddProduct, setShowAddProduct] = useState(false)

  if (loading) {
    return <p className="product-list__loading">Cargando bienes...</p>
  }

  if (totalCount === 0) {
    return (
      <section className="product-list">
        <h2 className="product-list__title">Inventario de bienes</h2>
        <div className="product-list__empty" role="status">
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
