import { TIPO_BIEN, FICHA_TECNICA_LABELS } from '../types/product'

const formatCLP = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value ?? 0)

const FichaLine = ({ label, value }) => {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null
  return (
    <p className="ficha-card__line">
      <strong>{label}:</strong> {Array.isArray(value) ? value.join(', ') : value}
    </p>
  )
}

const FichaTecnicaCard = ({ product }) => {
  if (!product) return null
  const imagenes = product.imagenesReferenciales ?? []
  const hasImagenes = Array.isArray(imagenes) && imagenes.length > 0

  return (
    <article className="ficha-card">
      <header className="ficha-card__header">
        <h3 className="ficha-card__title">{product.name}</h3>
        <span className="ficha-card__codigo">
          {product.codigoInventario ?? product.sku} · {TIPO_BIEN[product.tipoBien]}
        </span>
      </header>
      {hasImagenes && (
        <div className="ficha-card__imagenes">
          {imagenes.slice(0, 3).map((url, i) => (
            <img key={i} src={url} alt={`Referencia ${i + 1}`} className="ficha-card__img" />
          ))}
        </div>
      )}
      <div className="ficha-card__body">
        <FichaLine label="Descripción" value={product.description} />
        <FichaLine label={FICHA_TECNICA_LABELS.especificaciones} value={product.especificaciones} />
        <FichaLine label={FICHA_TECNICA_LABELS.caracteristicas} value={product.caracteristicas} />
        <FichaLine label={FICHA_TECNICA_LABELS.composicion} value={product.composicion} />
        <FichaLine label={FICHA_TECNICA_LABELS.material} value={product.material} />
        <FichaLine label={FICHA_TECNICA_LABELS.formato} value={product.formato} />
        <FichaLine label={FICHA_TECNICA_LABELS.origen} value={product.origen} />
        <FichaLine label={FICHA_TECNICA_LABELS.tamano} value={product.tamano} />
        <FichaLine label={FICHA_TECNICA_LABELS.certificaciones} value={product.certificaciones} />
        <p className="ficha-card__line">
          <strong>Cantidad:</strong> {product.quantity} · <strong>Valor en libros:</strong> {formatCLP(product.valorLibros)}
        </p>
      </div>
    </article>
  )
}

export default FichaTecnicaCard
