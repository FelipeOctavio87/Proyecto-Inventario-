import { Link } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { usePagination } from '../hooks/usePagination'
import FichaTecnicaCard from '../components/FichaTecnicaCard'

const PAGE_SIZE = 6

const CatalogoPage = () => {
  const { products, loading } = useProducts()
  const { pageItems, currentPage, totalPages, totalCount, prevPage, nextPage, from, to } = usePagination(
    products,
    PAGE_SIZE
  )

  if (loading) {
    return <p className="catalogo__loading">Cargando catálogo...</p>
  }

  if (totalCount === 0) {
    return (
      <div className="page catalogo-page">
        <section className="catalogo">
          <h2 className="catalogo__title">Catálogo de productos</h2>
          <p className="catalogo__subtitle">
            Ficha técnica por bien: especificaciones, características, composición, material, formato, origen, tamaño,
            certificaciones e imágenes referenciales.
          </p>
          <div className="catalogo__empty" role="status">
            <p className="catalogo__empty-text">
              No hay bienes en el catálogo. Cargue un archivo CSV en <strong>Cargar inventario</strong> para ver las fichas.
            </p>
            <Link to="/import" className="catalogo__empty-link">
              Ir a Cargar inventario
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page catalogo-page">
      <section className="catalogo">
        <h2 className="catalogo__title">Catálogo de productos</h2>
        <p className="catalogo__subtitle">
          Ficha técnica por bien: especificaciones, características, composición, material, formato, origen, tamaño,
          certificaciones e imágenes referenciales.
        </p>
        <p className="catalogo__pagination-info">
          Mostrando {from}-{to} de {totalCount} bienes
        </p>
        <div className="catalogo__grid">
          {pageItems.map((product) => (
            <FichaTecnicaCard key={product.id} product={product} />
          ))}
        </div>
        {totalPages > 1 && (
          <nav className="pagination" aria-label="Paginación catálogo">
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
      </section>
    </div>
  )
}

export default CatalogoPage
