import { Link } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { usePagination } from '../hooks/usePagination'
import { TIPO_BIEN } from '../types/product'

const formatCLP = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value ?? 0)

const totalValorizacion = (product) => (product.valorLibros ?? 0) * (product.quantity ?? 0)

const CostEarningTable = () => {
  const { products, loading } = useProducts()
  const { pageItems, currentPage, totalPages, totalCount, prevPage, nextPage, from, to } = usePagination(products)

  if (loading) {
    return <p className="cost-earning__loading">Cargando...</p>
  }

  if (totalCount === 0) {
    return (
      <section className="cost-earning">
        <h2 className="cost-earning__title">Valorización de activos</h2>
        <p className="cost-earning__subtitle">Conciliación contable y valor en libros – informe al 06.04.2026</p>
        <div className="cost-earning__empty" role="status">
          <p className="cost-earning__empty-text">
            No hay bienes cargados. Cargue un archivo CSV en <strong>Cargar inventario</strong> para ver la valorización.
          </p>
          <Link to="/import" className="cost-earning__empty-link">
            Ir a Cargar inventario
          </Link>
        </div>
      </section>
    )
  }

  const totalGeneral = products.reduce((sum, p) => sum + totalValorizacion(p), 0)

  return (
    <section className="cost-earning">
      <h2 className="cost-earning__title">Valorización de activos</h2>
      <p className="cost-earning__subtitle">Conciliación contable y valor en libros – informe al 06.04.2026</p>
      <p className="cost-earning__pagination-info">
        Mostrando {from}-{to} de {totalCount} bienes
      </p>
      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Valor unitario (libros)</th>
              <th>Valor total</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.codigoInventario ?? product.sku}</td>
                <td>{TIPO_BIEN[product.tipoBien] ?? product.tipoBien}</td>
                <td>{product.quantity}</td>
                <td>{formatCLP(product.valorLibros)}</td>
                <td className="cost-earning__total">{formatCLP(totalValorizacion(product))}</td>
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
      <p className="cost-earning__footer">
        <strong>Total valorización ({totalCount} bienes): {formatCLP(totalGeneral)}</strong>
      </p>
    </section>
  )
}

export default CostEarningTable
