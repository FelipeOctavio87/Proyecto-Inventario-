import { TIPO_BIEN, ESTADO_VERIFICACION, FICHA_TECNICA_LABELS } from '../types/product'

const formatCLP = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value ?? 0)

const FichaRow = ({ label, value }) => {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null
  return (
    <tr>
      <th className="ficha-tecnica__th">{label}</th>
      <td className="ficha-tecnica__td">{Array.isArray(value) ? value.join(', ') : value}</td>
    </tr>
  )
}

const FichaTecnicaModal = ({ product, onClose }) => {
  if (!product) return null

  const imagenes = product.imagenesReferenciales ?? []
  const hasImagenes = Array.isArray(imagenes) && imagenes.length > 0

  return (
    <div className="ficha-tecnica-overlay" role="dialog" aria-modal="true" aria-labelledby="ficha-tecnica-title">
      <div className="ficha-tecnica">
        <header className="ficha-tecnica__header">
          <h2 id="ficha-tecnica-title" className="ficha-tecnica__title">
            Ficha técnica y catálogo
          </h2>
          <button type="button" className="ficha-tecnica__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="ficha-tecnica__body">
          <h3 className="ficha-tecnica__product-name">{product.name}</h3>
          <p className="ficha-tecnica__codigo">
            Código: {product.codigoInventario ?? product.sku} · {TIPO_BIEN[product.tipoBien] ?? product.tipoBien}
          </p>

          {hasImagenes && (
            <div className="ficha-tecnica__imagenes">
              <h4>{FICHA_TECNICA_LABELS.imagenesReferenciales}</h4>
              <div className="ficha-tecnica__imagenes-grid">
                {imagenes.map((url, i) => (
                  <img key={i} src={url} alt={`Referencia ${i + 1}`} className="ficha-tecnica__img" />
                ))}
              </div>
            </div>
          )}

          <table className="ficha-tecnica__table">
            <tbody>
              <FichaRow label="Descripción" value={product.description} />
              <FichaRow label="Especificaciones" value={product.especificaciones} />
              <FichaRow label="Características" value={product.caracteristicas} />
              <FichaRow label="Composición" value={product.composicion} />
              <FichaRow label="Material" value={product.material} />
              <FichaRow label="Formato" value={product.formato} />
              <FichaRow label="Origen" value={product.origen} />
              <FichaRow label="Tamaño" value={product.tamano} />
              <FichaRow label="Certificaciones" value={product.certificaciones} />
              <tr>
                <th className="ficha-tecnica__th">Cantidad</th>
                <td className="ficha-tecnica__td">{product.quantity}</td>
              </tr>
              <tr>
                <th className="ficha-tecnica__th">Valor en libros</th>
                <td className="ficha-tecnica__td">{formatCLP(product.valorLibros)}</td>
              </tr>
              <tr>
                <th className="ficha-tecnica__th">Estado verificación</th>
                <td className="ficha-tecnica__td">
                  {ESTADO_VERIFICACION[product.estadoVerificacion] ?? product.estadoVerificacion}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <button type="button" className="ficha-tecnica-overlay__backdrop" onClick={onClose} aria-label="Cerrar" />
    </div>
  )
}

export default FichaTecnicaModal
