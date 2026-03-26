import { useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import PrintableLabel from '../components/PrintableLabel'

const IngresoEtiquetadoPage = () => {
  const { user } = useAuth()
  const { products, generateUnitItems, unitItems, clearUnitItems, markUnitsPrinted } = useInventory()
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [labelsBatch, setLabelsBatch] = useState([])
  const [error, setError] = useState('')
  const [storageMessage, setStorageMessage] = useState('')
  const [printMessage, setPrintMessage] = useState('')
  const printRef = useRef(null)
  const lastGeneratedKeysRef = useRef([])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === Number(productId)) ?? null,
    [products, productId]
  )

  const handleGenerate = () => {
    setError('')
    setPrintMessage('')
    const qty = Number(quantity)
    if (!productId) {
      setError('Seleccione un producto.')
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Ingrese una cantidad válida.')
      return
    }
    const result = generateUnitItems({
      productId: Number(productId),
      quantity: qty,
      actorEmail: user?.email || 'Felipe Rebolledo',
    })
    if (!result?.ok) {
      setError(result?.reason || 'No se pudieron generar las etiquetas.')
      return
    }
    setLabelsBatch(result.items || [])
    setStorageMessage('')
    lastGeneratedKeysRef.current = (result.items || []).map((it) => String(it.id_unidad ?? it.id ?? '').trim()).filter(Boolean)
    console.log('[INGRESO_ETIQUETADO][MOCK_UNIDADES]', result.items || [])
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedProduct
      ? `etiquetas-${selectedProduct.codigoInventario ?? selectedProduct.sku}`
      : 'etiquetas-datamatrix',
    onAfterPrint: () => {
      const keys = lastGeneratedKeysRef.current || []
      if (keys.length === 0) return
      markUnitsPrinted(keys, { actorEmail: user?.email })
      setPrintMessage('Etiquetas impresas: unidades marcadas como `etiqueta_impresa: true`.')
      lastGeneratedKeysRef.current = []
    },
  })

  const handleClearStoredUnits = () => {
    if (!window.confirm('¿Eliminar todas las unidades serializadas guardadas en este navegador?')) return
    clearUnitItems({ actorEmail: user?.email })
    setStorageMessage('Storage limpiado: inventory_units quedó vacío.')
    setLabelsBatch([])
    lastGeneratedKeysRef.current = []
  }

  const latestUnits = useMemo(() => {
    const list = Array.isArray(unitItems) ? unitItems : []
    return list
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.fecha_ingreso ?? a.ingresoAt ?? 0).getTime()
        const tb = new Date(b.fecha_ingreso ?? b.ingresoAt ?? 0).getTime()
        return tb - ta
      })
      .slice(0, 20)
  }, [unitItems])

  return (
    <div className="page ingreso-page">
      <section className="import">
        <h2 className="import__title">Ingreso y Etiquetado</h2>
        <p className="import__subtitle">
          Genera etiquetas unitarias DataMatrix para cada unidad física que ingresa a bodega.
        </p>

        <div className="import__block import__block--bienes-panel">
          <h3 className="import__block-title">Generación de etiquetas</h3>
          <p className="import__format-note">
            Estrategia actual: <strong>barcode + DataMatrix en paralelo</strong>. Barcode mantiene los flujos existentes;
            DataMatrix agrega trazabilidad unitaria serializada.
          </p>

          <div className="ingreso__controls">
            <div>
              <label className="product-list__filter-label" htmlFor="ingreso-producto">
                Producto base
              </label>
              <select
                id="ingreso-producto"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="product-list__filter-select"
              >
                <option value="">Seleccionar producto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.codigoInventario ?? p.sku})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="product-list__filter-label" htmlFor="ingreso-cantidad">
                Cantidad de unidades
              </label>
              <input
                id="ingreso-cantidad"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="product-list__filter-input"
              />
            </div>
          </div>

          {error && <p className="import__validation-msg import__validation-msg--error">{error}</p>}

          <div className="import__collab-actions">
            <button type="button" className="import__btn" onClick={handleGenerate}>
              Generar Etiquetas
            </button>
            <button
              type="button"
              className="import__btn import__btn--secondary"
              onClick={handlePrint}
              disabled={labelsBatch.length === 0}
            >
              Imprimir Etiquetas
            </button>
          </div>
        </div>

        {labelsBatch.length > 0 && (
          <div className="import__block import__block--bienes-panel">
            <h3 className="import__block-title">Etiquetas generadas ({labelsBatch.length})</h3>
            <div ref={printRef} className="labels-grid">
              {labelsBatch.map((item) => (
                <PrintableLabel key={item.id} item={item} />
              ))}
            </div>
            {printMessage && (
              <p className="import__validation-msg import__validation-msg--warn" style={{ marginTop: '0.75rem' }}>
                {printMessage}
              </p>
            )}
          </div>
        )}

        <div className="import__block import__block--bienes-panel">
          <h3 className="import__block-title">Inventario serializado (persistente local)</h3>
          <p className="import__format-note">
            Unidades guardadas en <code>localStorage</code> bajo la llave <code>inventory_units</code>.
          </p>
          {storageMessage && (
            <p className="import__validation-msg import__validation-msg--warn">{storageMessage}</p>
          )}
          <div className="import__collab-actions">
            <button
              type="button"
              className="import__btn import__btn--secondary"
              onClick={handleClearStoredUnits}
              disabled={(Array.isArray(unitItems) ? unitItems : []).length === 0}
            >
              Limpiar inventory_units
            </button>
          </div>
          {(!Array.isArray(unitItems) ? 0 : unitItems.length) === 0 ? (
            <p className="import__hint">Aún no hay unidades serializadas en este navegador.</p>
          ) : (
            <div className="product-table-wrapper">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>ID unidad</th>
                    <th>Serial humano</th>
                    <th>SKU Maestro</th>
                    <th>Impresa</th>
                    <th>Fecha ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {latestUnits.map((u) => (
                    <tr key={u.id_unidad ?? u.id}>
                      <td style={{ fontFamily: 'ui-monospace, monospace' }}>{u.id_unidad ?? '—'}</td>
                      <td style={{ fontWeight: 700 }}>{u.serial ?? '—'}</td>
                      <td>{u.sku_maestro ?? u.sku ?? '—'}</td>
                      <td>{u.etiqueta_impresa === true ? 'Sí' : 'No'}</td>
                      <td>{new Date(u.fecha_ingreso ?? u.ingresoAt ?? 0).toLocaleString('es-CL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default IngresoEtiquetadoPage

