import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useInventory } from '../context/InventoryContext'

/** Normaliza SKU para comparación (ej: "8000008164911.0" -> "8000008164911") */
const normalizeSku = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\.0+$/, '')

/** Nombre del archivo sin extensión */
const getNameWithoutExtension = (filename) => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.slice(0, lastDot) : filename
}

const BulkImageUploader = () => {
  const { products, addProductImages } = useInventory()
  const [lastResult, setLastResult] = useState(null)

  const processFiles = useCallback(
    (acceptedFiles) => {
      if (!acceptedFiles?.length) return

      const skuToProduct = new Map()
      products.forEach((p) => {
        const sku = normalizeSku(p.codigoInventario ?? p.sku)
        if (sku) skuToProduct.set(sku, p)
      })

      const matched = []
      const unmatched = []

      acceptedFiles.forEach((file) => {
        const nameWithoutExt = getNameWithoutExtension(file.name)
        const sku = normalizeSku(nameWithoutExt)
        const product = sku ? skuToProduct.get(sku) : null

        if (product) {
          const url = URL.createObjectURL(file)
          addProductImages(product.id, [url])
          matched.push({ file, url, productName: product.name, sku })
        } else {
          unmatched.push(file.name)
        }
      })

      setLastResult({
        successCount: matched.length,
        errorCount: unmatched.length,
        matched,
        unmatched,
      })
    },
    [products, addProductImages]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processFiles,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    multiple: true,
    noClick: false,
  })

  return (
    <div className="bulk-upload rounded-xl border-2 border-dashed border-slate-400 bg-slate-800/30 p-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-2">Carga masiva de imágenes</h3>
      <p className="text-sm text-slate-300 mb-4">
        Arrastra imágenes aquí. El nombre del archivo (sin extensión) debe coincidir con el SKU del producto (ej:{' '}
        <code className="bg-slate-700 px-1 rounded">8000008164911.png</code>).
      </p>

      <div
        {...getRootProps()}
        className={`
          flex flex-col items-center justify-center min-h-[160px] rounded-lg border-2 border-dashed cursor-pointer
          transition-colors py-8 px-4
          ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-500 hover:border-slate-400 hover:bg-slate-700/20'}
        `}
      >
        <input {...getInputProps()} aria-label="Soltar imágenes para asociar por SKU" />
        <svg
          className="w-12 h-12 text-slate-400 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-slate-300 text-center text-sm">
          {isDragActive ? 'Suelta las imágenes aquí…' : 'Arrastra imágenes aquí o haz clic para seleccionar'}
        </p>
      </div>

      {lastResult && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-green-400 font-medium">
              <span aria-hidden>✓</span> Fotos procesadas con éxito: <strong>{lastResult.successCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
              <span aria-hidden>!</span> Fotos sin SKU coincidente: <strong>{lastResult.errorCount}</strong>
            </span>
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
                    <img
                      src={item.url}
                      alt={item.productName}
                      className="w-full h-20 object-cover"
                    />
                    <span className="text-xs text-slate-400 truncate w-full px-1 py-0.5 text-center" title={item.productName}>
                      {item.sku}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastResult.unmatched.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-300 mb-2">Errores de asociación (renombrar para que coincida con un SKU)</h4>
              <ul className="text-sm text-slate-300 list-disc list-inside space-y-1 bg-slate-800/50 rounded-lg p-3">
                {lastResult.unmatched.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BulkImageUploader
