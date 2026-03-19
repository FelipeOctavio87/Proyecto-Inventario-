import { TIPO_BIEN, ESTADO_VERIFICACION } from '../types/product'
import { useInventory } from '../context/InventoryContext'
import { useProducts } from '../hooks/useProducts'
import BarcodeDisplay from './BarcodeDisplay'

const PLACEHOLDER_NO_PHOTO = `${import.meta.env.BASE_URL}sin-foto.png`

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

const readFilesAsDataUrls = (files) => {
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
    )
  )
}

const FichaTecnicaModal = ({ product, onClose }) => {
  const { addProductImages } = useInventory()
  const { products } = useProducts()
  const currentProduct = product ? (products.find((p) => p.id === product.id) ?? product) : null

  if (!currentProduct) return null

  const imagenes = currentProduct.imagenesReferenciales ?? []
  const hasImagenes = Array.isArray(imagenes) && imagenes.length > 0
  const fotoCount = imagenes.length

  const handleFileChange = (e) => {
    const files = e.target.files
    if (!files?.length) return
    readFilesAsDataUrls(files).then((urls) => {
      addProductImages(currentProduct.id, urls)
    })
    e.target.value = ''
  }

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
          <h3 className="ficha-tecnica__product-name">{currentProduct.name}</h3>
          <p className="ficha-tecnica__codigo">
            Código: {currentProduct.codigoInventario ?? currentProduct.sku} · {TIPO_BIEN[currentProduct.tipoBien] ?? currentProduct.tipoBien}
          </p>

          <div className="mt-4">
            <BarcodeDisplay value={currentProduct.barcode} />
          </div>

          <div className="ficha-tecnica__imagenes">
            <h4>Fotos</h4>
            <div className="ficha-tecnica__imagenes-row">
              <div className="ficha-tecnica__imagenes-grid">
                {hasImagenes ? (
                  imagenes.map((url, i) => (
                    <img key={i} src={url} alt={`Foto ${i + 1}`} className="ficha-tecnica__img" />
                  ))
                ) : (
                  <img src={PLACEHOLDER_NO_PHOTO} alt="Sin foto" className="ficha-tecnica__img ficha-tecnica__img--placeholder" />
                )}
              </div>
              <div className="ficha-tecnica__add-photos">
                <label className="ficha-tecnica__btn-photos">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="ficha-tecnica__file-input"
                    aria-label="Seleccionar fotos"
                  />
                  Agregar Fotos
                </label>
              </div>
            </div>
          </div>

          <table className="ficha-tecnica__table">
            <tbody>
              <tr>
                <th className="ficha-tecnica__th">Fotos</th>
                <td className="ficha-tecnica__td">{fotoCount === 1 ? '1' : fotoCount === 0 ? '0' : `${fotoCount}`}</td>
              </tr>
              <FichaRow label="Descripción" value={currentProduct.description} />
              <FichaRow label="Especificaciones" value={currentProduct.especificaciones} />
              <FichaRow label="Características" value={currentProduct.caracteristicas} />
              <FichaRow label="Composición" value={currentProduct.composicion} />
              <FichaRow label="Material" value={currentProduct.material} />
              <FichaRow label="Formato" value={currentProduct.formato} />
              <FichaRow label="Origen" value={currentProduct.origen} />
              <FichaRow label="Tamaño" value={currentProduct.tamano} />
              <FichaRow label="Certificaciones" value={currentProduct.certificaciones} />
              <tr>
                <th className="ficha-tecnica__th">Cantidad</th>
                <td className="ficha-tecnica__td">{currentProduct.quantity}</td>
              </tr>
              <tr>
                <th className="ficha-tecnica__th">Valor en libros</th>
                <td className="ficha-tecnica__td">{formatCLP(currentProduct.valorLibros)}</td>
              </tr>
              <tr>
                <th className="ficha-tecnica__th">Estado verificación</th>
                <td className="ficha-tecnica__td">
                  {ESTADO_VERIFICACION[currentProduct.estadoVerificacion] ?? currentProduct.estadoVerificacion}
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
