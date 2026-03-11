import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { usePagination } from '../hooks/usePagination'
import { TIPO_BIEN, ESTADO_VERIFICACION } from '../types/product'
import FichaTecnicaModal from './FichaTecnicaModal'

const formatCLP = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value ?? 0)

const ProductList = () => {
  const { products, loading } = useProducts()
  const { pageItems, currentPage, totalPages, totalCount, prevPage, nextPage, from, to } = usePagination(products)
  const [fichaProduct, setFichaProduct] = useState(null)

  if (loading) {
    return <p className="product-list__loading">Cargando bienes...</p>
  }

  if (totalCount === 0) {
    return (
      <section className="product-list">
        <h2 className="product-list__title">Inventario de bienes muebles e inmuebles</h2>
        <p className="product-list__subtitle">Corte 28.02.2026 – SLEP Litoral (Ley N° 24.040)</p>
        <div className="product-list__empty" role="status">
          <p className="product-list__empty-text">
            No hay bienes cargados. Los bienes se muestran aquí solo después de cargar un archivo CSV en la pestaña
            <strong> Cargar inventario</strong>.
          </p>
          <Link to="/import" className="product-list__empty-link">
            Ir a Cargar inventario
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="product-list">
      <h2 className="product-list__title">Inventario de bienes muebles e inmuebles</h2>
      <p className="product-list__subtitle">Corte 28.02.2026 – SLEP Litoral (Ley N° 24.040)</p>
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
                <td>{ESTADO_VERIFICACION[product.estadoVerificacion] ?? product.estadoVerificacion}</td>
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
    </section>
  )
}

export default ProductList
