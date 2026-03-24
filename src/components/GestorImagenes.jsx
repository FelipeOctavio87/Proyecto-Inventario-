import { useCallback, useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import JSZip from 'jszip'
import { Upload, Trash2, Camera, CheckCircle, X, Loader2, AlertCircle } from 'lucide-react'
import { useInventory } from '../context/InventoryContext'
import { useAuth } from '../context/AuthContext'
import { sanitizeSKU } from '../utils/parseCsvBienes'

/** Extensiones de imagen que aceptamos (en dropzone y dentro del ZIP) */
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i

/** Clave de SKU alineada con importación CSV (alfanumérico + ._-) */
const skuKey = (value) => {
  const r = sanitizeSKU(value)
  if (r.valid) return r.value
  return String(value ?? '')
    .trim()
    .replace(/\.0+$/, '')
}

const getNameWithoutExtension = (filename) => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.slice(0, lastDot) : filename
}

/** Extrae archivos de imagen de un ZIP y devuelve File[] (nombre = nombre dentro del ZIP, sin rutas) */
async function extractImagesFromZip(zipFile) {
  const zip = await JSZip.loadAsync(zipFile)
  const files = []
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const baseName = path.replace(/^.*[/\\]/, '')
    if (!IMAGE_EXT.test(baseName)) continue
    const blob = await entry.async('blob')
    const mime = blob.type || (baseName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')
    files.push(new File([blob], baseName, { type: mime }))
  }
  return files
}

const PLACEHOLDER_NO_PHOTO = `${import.meta.env.BASE_URL}sin-foto.png`

/** Lightbox simple para previsualización */
const Lightbox = ({ src, alt, onClose }) => {
  if (!src) return null
  return (
    <div
      className="gestor-imagenes__lightbox-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa de imagen"
    >
      <button
        type="button"
        onClick={onClose}
        className="gestor-imagenes__lightbox-close"
        aria-label="Cerrar"
      >
        <X className="gestor-imagenes__lightbox-close-icon" strokeWidth={2} />
      </button>
      <img
        src={src}
        alt={alt ?? 'Imagen'}
        className="gestor-imagenes__lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

export default function GestorImagenes() {
  const { products, addProductImages, clearAllProductImages, logAuditEvent } = useInventory()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('bulk')
  const [lastResult, setLastResult] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [zipLoading, setZipLoading] = useState(false)
  const [pendingBulk, setPendingBulk] = useState(null)
  const fileInputRef = useRef(null)
  const uploadTargetIdRef = useRef(null)

  const revokePendingPreviews = useCallback((bulk) => {
    if (!bulk?.matched) return
    bulk.matched.forEach((m) => {
      if (m.previewUrl) {
        try {
          URL.revokeObjectURL(m.previewUrl)
        } catch {
          /* ignore */
        }
      }
    })
  }, [])

  const analyzeBulkFiles = useCallback(
    (acceptedFiles) => {
      if (!acceptedFiles?.length) return null
      const skuToProduct = new Map()
      products.forEach((p) => {
        const key = skuKey(p.codigoInventario ?? p.sku)
        if (key) skuToProduct.set(key, p)
      })

      const matched = []
      const unmatchedFiles = []
      const duplicateInBatch = []
      const formatInvalid = []
      const seenSku = new Map()

      acceptedFiles.forEach((file) => {
        if (!IMAGE_EXT.test(file.name)) {
          formatInvalid.push(file.name)
          return
        }
        const base = getNameWithoutExtension(file.name)
        const res = sanitizeSKU(base)
        const key = res.valid ? res.value : String(base).trim()
        if (!res.valid && !/^[A-Za-z0-9._-]+$/.test(String(base).trim())) {
          formatInvalid.push(file.name)
          return
        }
        const product = key ? skuToProduct.get(key) : null
        if (!product) {
          unmatchedFiles.push({ fileName: file.name, reason: 'SKU_INEXISTENTE' })
          return
        }
        if (seenSku.has(key)) {
          duplicateInBatch.push({
            sku: key,
            file: file.name,
            firstFile: seenSku.get(key),
          })
          return
        }
        seenSku.set(key, file.name)
        matched.push({
          file,
          product,
          sku: key,
          productName: product.name,
          previewUrl: URL.createObjectURL(file),
        })
      })

      return { matched, unmatchedFiles, duplicateInBatch, formatInvalid }
    },
    [products]
  )

  const discardPendingBulk = useCallback(() => {
    setPendingBulk((prev) => {
      if (prev) revokePendingPreviews(prev)
      return null
    })
  }, [revokePendingPreviews])

  const confirmBulkApplication = useCallback(() => {
    if (!pendingBulk?.matched?.length) {
      setPendingBulk(null)
      return
    }
    const matched = pendingBulk.matched
    matched.forEach(({ product, sku, previewUrl }) => {
      const beforeImages = Array.isArray(product.imagenesReferenciales)
        ? [...product.imagenesReferenciales]
        : []
      const afterImages = [...beforeImages, previewUrl]
      addProductImages(product.id, [previewUrl])
      const baseVersion = product.version ?? 1
      logAuditEvent({
        usuario: user?.email || 'Sistema',
        accion: 'Carga de Imagen',
        actionType: 'IMAGE_UPDATE',
        targetSku: product.codigoInventario ?? product.sku ?? sku,
        previousValue: beforeImages,
        newValue: afterImages,
        detalle: `Se agregó una imagen al producto "${product.name}" (SKU ${product.codigoInventario ?? product.sku ?? sku}).`,
        productoId: product.id,
        sku: product.codigoInventario ?? product.sku ?? sku,
        estadoAnterior: { imagenesReferenciales: beforeImages, version: baseVersion },
        estadoNuevo: { imagenesReferenciales: afterImages, version: baseVersion + 1 },
        reversible: true,
      })
    })
    const productosSinFoto = products.filter(
      (p) => !Array.isArray(p.imagenesReferenciales) || p.imagenesReferenciales.length === 0
    ).length
    setLastResult({
      successCount: matched.length,
      errorCount: pendingBulk.unmatchedFiles.length + pendingBulk.duplicateInBatch.length,
      matched: matched.map((m) => ({
        url: m.previewUrl,
        productName: m.productName,
        sku: m.sku,
      })),
      unmatched: pendingBulk.unmatchedFiles.map((u) => u.fileName),
      duplicateInBatch: pendingBulk.duplicateInBatch,
      formatInvalid: pendingBulk.formatInvalid,
      productosSinFoto,
    })
    setPendingBulk(null)
  }, [pendingBulk, addProductImages, logAuditEvent, user, products])

  const processFiles = useCallback(
    (acceptedFiles) => {
      if (!acceptedFiles?.length) return
      setPendingBulk((prev) => {
        if (prev) revokePendingPreviews(prev)
        return analyzeBulkFiles(acceptedFiles)
      })
    },
    [analyzeBulkFiles, revokePendingPreviews]
  )

  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (!acceptedFiles?.length) return
      const imageFiles = acceptedFiles.filter((f) => IMAGE_EXT.test(f.name))
      const zipFiles = acceptedFiles.filter((f) => /\.zip$/i.test(f.name))
      let allImages = [...imageFiles]
      if (zipFiles.length > 0) {
        setZipLoading(true)
        try {
          for (const z of zipFiles) {
            const extracted = await extractImagesFromZip(z)
            allImages = allImages.concat(extracted)
          }
        } finally {
          setZipLoading(false)
        }
      }
      if (allImages.length > 0) processFiles(allImages)
    },
    [processFiles]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/zip': ['.zip'],
    },
    multiple: true,
  })

  const handleClearAll = useCallback(() => {
    if (window.confirm('¿Eliminar todas las imágenes asociadas a los productos?')) {
      const totalProductos = products.length
      const productosConFoto = products.filter(
        (p) => Array.isArray(p.imagenesReferenciales) && p.imagenesReferenciales.length > 0
      ).length

      clearAllProductImages()
      setLastResult(null)

      logAuditEvent({
        usuario: user?.email || 'Felipe Rebolledo',
        accion: 'Limpieza de Imágenes',
        actionType: 'IMAGE_CLEAR_ALL',
        targetSku: null,
        previousValue: { productosConFoto, totalProductos },
        newValue: { productosConFoto: 0, totalProductos },
        detalle: `Se eliminaron todas las imágenes de ${productosConFoto} productos (de un total de ${totalProductos}).`,
        estadoAnterior: {
          productosConFoto,
          totalProductos,
        },
        estadoNuevo: {
          productosConFoto: 0,
          totalProductos,
        },
        reversible: false,
      })
    }
  }, [clearAllProductImages, logAuditEvent, products, user])

  const handleIndividualUpload = (e) => {
    const file = e.target.files?.[0]
    const productId = uploadTargetIdRef.current
    if (!file || !productId) return
    const url = URL.createObjectURL(file)
    const product = products.find((p) => p.id === productId)
    addProductImages(productId, [url])
    if (product) {
      const beforeImages = Array.isArray(product.imagenesReferenciales)
        ? [...product.imagenesReferenciales]
        : []
      const afterImages = [...beforeImages, url]
      const baseVersion = product.version ?? 1
      logAuditEvent({
        usuario: user?.email || 'Felipe Rebolledo',
        accion: 'Carga de Imagen',
        actionType: 'IMAGE_UPDATE',
        targetSku: product.codigoInventario ?? product.sku,
        previousValue: beforeImages,
        newValue: afterImages,
        detalle: `Se agregó una imagen manualmente al producto "${product.name}" (SKU ${product.codigoInventario ?? product.sku ?? 'sin código'}).`,
        productoId: product.id,
        sku: product.codigoInventario ?? product.sku,
        estadoAnterior: { imagenesReferenciales: beforeImages, version: baseVersion },
        estadoNuevo: { imagenesReferenciales: afterImages, version: baseVersion + 1 },
        reversible: true,
      })
    }
    uploadTargetIdRef.current = null
    e.target.value = ''
  }

  const hasImage = (p) => Array.isArray(p.imagenesReferenciales) && p.imagenesReferenciales.length > 0
  const mainImageUrl = (p) => (hasImage(p) ? p.imagenesReferenciales[0] : null)

  const dropzoneClass = [
    'gestor-imagenes__dropzone',
    zipLoading && 'gestor-imagenes__dropzone--loading',
    isDragActive && 'gestor-imagenes__dropzone--drag',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="gestor-imagenes">
      <div className="gestor-imagenes__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bulk'}
          onClick={() => setActiveTab('bulk')}
          className={`gestor-imagenes__tab ${activeTab === 'bulk' ? 'gestor-imagenes__tab--active' : ''}`}
        >
          Carga Masiva
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'product'}
          onClick={() => setActiveTab('product')}
          className={`gestor-imagenes__tab ${activeTab === 'product' ? 'gestor-imagenes__tab--active' : ''}`}
        >
          Gestión por Producto
        </button>
      </div>

      <div className="gestor-imagenes__body">
        {activeTab === 'bulk' && (
          <>
            <h3 className="gestor-imagenes__heading">Importación Inteligente por SKU</h3>
            <p className="gestor-imagenes__lead">
              Suelta imágenes o un <strong>ZIP</strong> con fotos nombradas por SKU. El sistema vinculará cada archivo al
              producto cuyo SKU coincida con el nombre (sin extensión). Ej:{' '}
              <code className="gestor-imagenes__code">8000008164911.jpg</code> o un ZIP con muchas así.
            </p>

            <div {...getRootProps()} className={dropzoneClass}>
              <input {...getInputProps()} aria-label="Soltar imágenes o ZIP para asociar por SKU" />
              {zipLoading ? (
                <Loader2 className="gestor-imagenes__dropzone-icon gestor-imagenes__dropzone-icon--spin" strokeWidth={1.5} aria-hidden />
              ) : (
                <Upload className="gestor-imagenes__dropzone-icon" strokeWidth={1.5} aria-hidden />
              )}
              <p className="gestor-imagenes__dropzone-text">
                {zipLoading
                  ? 'Extrayendo imágenes del ZIP…'
                  : isDragActive
                    ? 'Suelta las imágenes o el ZIP aquí…'
                    : 'Arrastra imágenes o un ZIP aquí, o haz clic para seleccionar'}
              </p>
            </div>

            {pendingBulk && (
              <div className="gestor-imagenes__preview" role="region" aria-label="Vista previa de carga masiva de imágenes">
                <div className="gestor-imagenes__preview-title">
                  <AlertCircle className="gestor-imagenes__icon-md" strokeWidth={2} aria-hidden />
                  Revisa el diagnóstico antes de aplicar
                </div>
                <div className="gestor-imagenes__preview-stats">
                  <div>
                    <span className="gestor-imagenes__stat-ok">{pendingBulk.matched.length}</span> vincularán
                    correctamente
                  </div>
                  <div>
                    <span className="gestor-imagenes__stat-warn">{pendingBulk.unmatchedFiles.length}</span> SKU
                    inexistente
                  </div>
                  <div>
                    <span className="gestor-imagenes__stat-dup">{pendingBulk.duplicateInBatch.length}</span>{' '}
                    duplicado en este lote
                  </div>
                  <div>
                    <span className="gestor-imagenes__stat-err">{pendingBulk.formatInvalid.length}</span> formato no
                    válido
                  </div>
                </div>
                {pendingBulk.matched.length > 0 && (
                  <div>
                    <h4 className="gestor-imagenes__preview-subtitle">Vista previa (aplicar)</h4>
                    <div className="gestor-imagenes__thumb-grid">
                      {pendingBulk.matched.map((m, i) => (
                        <div key={i} className="gestor-imagenes__thumb">
                          <img src={m.previewUrl} alt="" />
                          <span className="gestor-imagenes__thumb-label">{m.sku}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(pendingBulk.unmatchedFiles.length > 0 ||
                  pendingBulk.duplicateInBatch.length > 0 ||
                  pendingBulk.formatInvalid.length > 0) && (
                  <ul className="gestor-imagenes__issue-list">
                    {pendingBulk.formatInvalid.map((name, i) => (
                      <li key={`f-${i}`}>
                        <span className="gestor-imagenes__stat-err">Formato no válido</span>: {name}
                      </li>
                    ))}
                    {pendingBulk.unmatchedFiles.map((u, i) => (
                      <li key={`u-${i}`}>
                        <span className="gestor-imagenes__stat-warn">SKU inexistente</span>: {u.fileName}
                      </li>
                    ))}
                    {pendingBulk.duplicateInBatch.map((d, i) => (
                      <li key={`d-${i}`}>
                        <span className="gestor-imagenes__stat-dup">Duplicado en lote</span> SKU {d.sku}: {d.file} (ya usado{' '}
                        {d.firstFile})
                      </li>
                    ))}
                  </ul>
                )}
                <div className="gestor-imagenes__preview-actions">
                  <button
                    type="button"
                    onClick={confirmBulkApplication}
                    disabled={pendingBulk.matched.length === 0}
                    className="import__btn"
                  >
                    <span className="gestor-imagenes__btn-inner">
                      <CheckCircle className="gestor-imagenes__icon-sm" strokeWidth={2} />
                      Confirmar y aplicar
                    </span>
                  </button>
                  <button type="button" onClick={discardPendingBulk} className="import__btn import__btn--secondary">
                    Descartar
                  </button>
                </div>
              </div>
            )}

            <div className="gestor-imagenes__toolbar">
              <button type="button" onClick={handleClearAll} className="import__btn import__btn--danger">
                <span className="gestor-imagenes__btn-inner">
                  <Trash2 className="gestor-imagenes__icon-sm" strokeWidth={2} />
                  Limpiar Todo
                </span>
              </button>
            </div>

            {lastResult && (
              <div className="gestor-imagenes__result-stack">
                <div className="gestor-imagenes__result-block">
                  <div className="gestor-imagenes__result-head">
                    <CheckCircle className="gestor-imagenes__icon-md" strokeWidth={2} aria-hidden />
                    <span>Resumen de carga masiva</span>
                  </div>
                  <div className="gestor-imagenes__result-grid">
                    <div>
                      <strong className="gestor-imagenes__r-ok">{lastResult.successCount}</strong> fotos asociadas con
                      éxito
                    </div>
                    <div>
                      <strong className="gestor-imagenes__r-warn">{lastResult.errorCount}</strong> no aplicadas (sin
                      SKU, duplicado en lote o formato)
                    </div>
                    <div>
                      <strong className="gestor-imagenes__r-info">{lastResult.productosSinFoto}</strong> SKUs que aún no
                      tienen foto
                    </div>
                  </div>
                </div>
                {lastResult.matched.length > 0 && (
                  <div>
                    <h4 className="gestor-imagenes__section-label">Asociadas ({lastResult.matched.length})</h4>
                    <div className="gestor-imagenes__thumb-grid gestor-imagenes__thumb-grid--result">
                      {lastResult.matched.map((item, i) => (
                        <div key={i} className="gestor-imagenes__thumb">
                          <img src={item.url} alt={item.productName} />
                          <span className="gestor-imagenes__thumb-label">{item.sku}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lastResult.unmatched.length > 0 && (
                  <div className="gestor-imagenes__error-panel">
                    <button
                      type="button"
                      onClick={() => setShowErrors((v) => !v)}
                      className="gestor-imagenes__error-toggle"
                    >
                      <span>Errores de asociación (renombrar para coincidir con SKU)</span>
                      <span className="gestor-imagenes__toggle-meta">
                        {showErrors ? 'Ocultar lista' : 'Mostrar lista'} ({lastResult.unmatched.length})
                      </span>
                    </button>
                    {showErrors && (
                      <ul className="gestor-imagenes__error-list">
                        {lastResult.unmatched.map((name, i) => (
                          <li key={i}>{name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'product' && (
          <>
            <h3 className="gestor-imagenes__heading">Inventario</h3>
            <p className="gestor-imagenes__lead">
              Asigna una imagen a cada producto con el botón de cámara. La miniatura es clicable para ampliar.
            </p>
            {products.length === 0 ? (
              <p className="gestor-imagenes__empty">No hay productos. Carga primero un CSV en la sección superior.</p>
            ) : (
              <div className="gestor-imagenes__table-wrap">
                <table className="gestor-imagenes__table" role="table">
                  <thead>
                    <tr>
                      <th className="gestor-imagenes__th-narrow">Foto</th>
                      <th>Nombre</th>
                      <th>SKU</th>
                      <th className="gestor-imagenes__th-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const mainUrl = mainImageUrl(p)
                      return (
                        <tr key={p.id}>
                          <td>
                            <button
                              type="button"
                              onClick={() => mainUrl && setLightboxSrc(mainUrl)}
                              className={`gestor-imagenes__thumb-btn ${mainUrl ? 'gestor-imagenes__thumb-btn--clickable' : ''}`}
                              aria-label={mainUrl ? `Ampliar foto de ${p.name}` : 'Sin foto'}
                            >
                              <img src={mainUrl ?? PLACEHOLDER_NO_PHOTO} alt={p.name} />
                            </button>
                          </td>
                          <td>
                            <span className="gestor-imagenes__cell-strong">{p.name}</span>
                          </td>
                          <td>
                            <span className="gestor-imagenes__sku-cell">
                              {p.codigoInventario ?? p.sku ?? '—'}
                              {hasImage(p) && (
                                <CheckCircle className="gestor-imagenes__icon-sm" strokeWidth={2} aria-label="Tiene imagen" />
                              )}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                uploadTargetIdRef.current = p.id
                                fileInputRef.current?.click()
                              }}
                              className="gestor-imagenes__cam-btn"
                            >
                              <Camera className="gestor-imagenes__icon-sm" strokeWidth={2} />
                              Subir
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="gestor-imagenes__hidden-input"
          onChange={handleIndividualUpload}
          aria-label="Subir imagen del producto"
        />
      </div>

      {lightboxSrc && (
        <Lightbox src={lightboxSrc} alt="Vista previa" onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}
