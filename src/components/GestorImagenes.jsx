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
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa de imagen"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Cerrar"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt={alt ?? 'Imagen'}
        className="max-w-full max-h-full object-contain"
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

  return (
    <div className="gestor-imagenes rounded-xl border border-slate-600 bg-slate-800/40 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-600">
        <button
          type="button"
          onClick={() => setActiveTab('bulk')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'bulk'
              ? 'bg-slate-700 text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          Carga Masiva
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('product')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'product'
              ? 'bg-slate-700 text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          Gestión por Producto
        </button>
      </div>

      <div className="p-5">
        {activeTab === 'bulk' && (
          <>
            <h3 className="text-lg font-semibold text-slate-100 mb-1">Importación Inteligente por SKU</h3>
            <p className="text-sm text-slate-300 mb-4">
              Suelta imágenes o un <strong>ZIP</strong> con fotos nombradas por SKU. El sistema vinculará cada archivo al producto cuyo SKU coincida con el nombre (sin extensión). Ej:{' '}
              <code className="bg-slate-700 px-1.5 py-0.5 rounded">8000008164911.jpg</code> o un ZIP con muchas así.
            </p>

            <div
              {...getRootProps()}
              className={`
                relative flex flex-col items-center justify-center min-h-[180px] rounded-lg border-2 border-dashed cursor-pointer
                transition-colors py-8 px-4
                ${zipLoading ? 'pointer-events-none opacity-70' : ''}
                ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-500 hover:border-slate-400 bg-slate-800/30 hover:bg-slate-700/30'}
              `}
            >
              <input {...getInputProps()} aria-label="Soltar imágenes o ZIP para asociar por SKU" />
              {zipLoading ? (
                <Loader2 className="w-12 h-12 text-indigo-400 mb-2 animate-spin" strokeWidth={1.5} aria-hidden />
              ) : (
                <Upload className="w-12 h-12 text-slate-400 mb-2" strokeWidth={1.5} />
              )}
              <p className="text-slate-300 text-center text-sm">
                {zipLoading
                  ? 'Extrayendo imágenes del ZIP…'
                  : isDragActive
                    ? 'Suelta las imágenes o el ZIP aquí…'
                    : 'Arrastra imágenes o un ZIP aquí, o haz clic para seleccionar'}
              </p>
            </div>

            {pendingBulk && (
              <div
                className="mt-5 rounded-lg border border-indigo-500/50 bg-slate-900/80 p-4 space-y-3"
                role="region"
                aria-label="Vista previa de carga masiva de imágenes"
              >
                <div className="flex items-center gap-2 text-indigo-200 font-semibold text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  Revisa el diagnóstico antes de aplicar
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 text-xs text-slate-200">
                  <div>
                    <span className="text-emerald-400 font-semibold">{pendingBulk.matched.length}</span> vincularán
                    correctamente
                  </div>
                  <div>
                    <span className="text-amber-400 font-semibold">{pendingBulk.unmatchedFiles.length}</span> SKU
                    inexistente
                  </div>
                  <div>
                    <span className="text-orange-400 font-semibold">{pendingBulk.duplicateInBatch.length}</span>{' '}
                    duplicado en este lote
                  </div>
                  <div>
                    <span className="text-red-400 font-semibold">{pendingBulk.formatInvalid.length}</span> formato no
                    válido
                  </div>
                </div>
                {pendingBulk.matched.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-300 mb-2">Vista previa (aplicar)</h4>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                      {pendingBulk.matched.map((m, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center rounded-lg overflow-hidden border border-slate-600 bg-slate-800 w-20"
                        >
                          <img src={m.previewUrl} alt="" className="w-full h-16 object-cover" />
                          <span className="text-[10px] text-slate-400 truncate w-full px-1 py-0.5 text-center">
                            {m.sku}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(pendingBulk.unmatchedFiles.length > 0 ||
                  pendingBulk.duplicateInBatch.length > 0 ||
                  pendingBulk.formatInvalid.length > 0) && (
                  <ul className="text-xs text-slate-400 space-y-1 max-h-32 overflow-y-auto list-disc list-inside">
                    {pendingBulk.formatInvalid.map((name, i) => (
                      <li key={`f-${i}`}>
                        <span className="text-red-300">Formato no válido</span>: {name}
                      </li>
                    ))}
                    {pendingBulk.unmatchedFiles.map((u, i) => (
                      <li key={`u-${i}`}>
                        <span className="text-amber-300">SKU inexistente</span>: {u.fileName}
                      </li>
                    ))}
                    {pendingBulk.duplicateInBatch.map((d, i) => (
                      <li key={`d-${i}`}>
                        <span className="text-orange-300">Duplicado en lote</span> SKU {d.sku}: {d.file} (ya usado{' '}
                        {d.firstFile})
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={confirmBulkApplication}
                    disabled={pendingBulk.matched.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar y aplicar
                  </button>
                  <button
                    type="button"
                    onClick={discardPendingBulk}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-500 text-slate-200 text-sm hover:bg-slate-700/50"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Limpiar Todo
              </button>
            </div>

            {lastResult && (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-600 bg-slate-800/70 px-4 py-3 text-sm text-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span className="font-semibold">Resumen de carga masiva</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 text-xs sm:text-sm">
                    <div>
                      <span className="font-semibold text-emerald-300">
                        {lastResult.successCount}
                      </span>{' '}
                      fotos asociadas con éxito
                    </div>
                    <div>
                      <span className="font-semibold text-amber-300">
                        {lastResult.errorCount}
                      </span>{' '}
                      no aplicadas (sin SKU, duplicado en lote o formato)
                    </div>
                    <div>
                      <span className="font-semibold text-sky-300">
                        {lastResult.productosSinFoto}
                      </span>{' '}
                      SKUs que aún no tienen foto
                    </div>
                  </div>
                </div>
                {lastResult.matched.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Asociadas ({lastResult.matched.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {lastResult.matched.map((item, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center rounded-lg overflow-hidden border border-slate-600 bg-slate-800 w-24"
                        >
                          <img src={item.url} alt={item.productName} className="w-full h-20 object-cover" />
                          <span className="text-xs text-slate-400 truncate w-full px-1 py-0.5 text-center">{item.sku}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lastResult.unmatched.length > 0 && (
                  <div className="border border-slate-600 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowErrors((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-red-200"
                    >
                      <span>Errores de asociación (renombrar para coincidir con SKU)</span>
                      <span className="text-xs">
                        {showErrors ? 'Ocultar lista' : 'Mostrar lista'} ({lastResult.unmatched.length})
                      </span>
                    </button>
                    {showErrors && (
                      <ul className="text-sm text-slate-200 list-disc list-inside space-y-1 bg-slate-900/70 p-3 max-h-48 overflow-auto">
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
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Inventario</h3>
            <p className="text-sm text-slate-300 mb-4">
              Asigna una imagen a cada producto con el botón de cámara. La miniatura es clicable para ampliar.
            </p>
            {products.length === 0 ? (
              <p className="text-slate-400 text-sm">No hay productos. Carga primero un CSV en la sección superior.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-600">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-700/50 text-slate-200">
                    <tr>
                      <th className="px-3 py-3 w-20 border-b border-slate-500">Foto</th>
                      <th className="px-3 py-3 border-b border-slate-500">Nombre</th>
                      <th className="px-3 py-3 border-b border-slate-500">SKU</th>
                      <th className="px-3 py-3 w-32 border-b border-slate-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {products.map((p) => {
                      const mainUrl = mainImageUrl(p)
                      return (
                        <tr key={p.id} className="hover:bg-slate-700/30 border-b border-slate-500 last:border-b-0">
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => mainUrl && setLightboxSrc(mainUrl)}
                              className={`block w-14 h-14 rounded border overflow-hidden bg-slate-700 ${mainUrl ? 'cursor-pointer hover:ring-2 ring-indigo-500' : 'cursor-default'}`}
                            >
                              <img
                                src={mainUrl ?? PLACEHOLDER_NO_PHOTO}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          </td>
                          <td className="px-3 py-3 font-medium text-slate-100">{p.name}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              {p.codigoInventario ?? p.sku ?? '—'}
                              {hasImage(p) && (
                                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" aria-label="Tiene imagen" />
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                uploadTargetIdRef.current = p.id
                                fileInputRef.current?.click()
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                            >
                              <Camera className="w-4 h-4" />
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
          className="hidden"
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
