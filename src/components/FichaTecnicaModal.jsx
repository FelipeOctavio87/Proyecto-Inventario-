import { useEffect, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  TIPO_BIEN,
  ESTADO_VERIFICACION,
  UBICACION_FISICA_OPTIONS,
  DEFAULT_UBICACION_FISICA,
  labelUbicacionFisica,
} from '../types/product'
import { useInventory } from '../context/InventoryContext'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../hooks/useProducts'
import BarcodeDisplay from './BarcodeDisplay'
import PrintableLabel from './PrintableLabel'
import {
  barcodesMatchForManualAdjust,
  isBarcodeEligibleForManualAdjust,
} from '../utils/barcodeManualAdjust'

const PLACEHOLDER_NO_PHOTO = `${import.meta.env.BASE_URL}sin-foto.png`

/** Ventana máxima (primer→último carácter) para considerar entrada tipo lector, no teclado. */
const BARCODE_SCAN_MAX_TOTAL_MS = 2000
/** Máx. ms entre dos caracteres consecutivos; por encima suele ser escritura manual. */
const BARCODE_SCAN_MAX_GAP_MS = 90

const emptyScanBurst = () => ({
  firstAt: null,
  lastAt: null,
  maxGapMs: 0,
  prevKeyAt: null,
})

/**
 * @param {{ current: { firstAt: number | null, lastAt: number | null, maxGapMs: number } }} ref
 * @param {number} len
 */
const isLikelyBarcodeScannerInput = (ref, len) => {
  if (len < 1) return false
  const { firstAt, lastAt, maxGapMs } = ref.current
  if (firstAt == null || lastAt == null) return false
  const total = lastAt - firstAt
  if (total > BARCODE_SCAN_MAX_TOTAL_MS) return false
  if (len >= 2 && maxGapMs > BARCODE_SCAN_MAX_GAP_MS) return false
  return true
}

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
  const { user } = useAuth()
  const { addProductImages, updateProduct, unitItems, markUnitsPrinted } = useInventory()
  const { products } = useProducts()
  const currentProduct = product ? (products.find((p) => p.id === product.id) ?? product) : null

  const [ubicacionEdit, setUbicacionEdit] = useState(DEFAULT_UBICACION_FISICA)
  const [detalleUbicacionEdit, setDetalleUbicacionEdit] = useState('')
  const [ubicacionFeedback, setUbicacionFeedback] = useState('')

  const [cantidadEdit, setCantidadEdit] = useState('')
  const [cantidadMotivo, setCantidadMotivo] = useState('')
  const [cantidadBarcodeScan, setCantidadBarcodeScan] = useState('')
  const [cantidadFeedback, setCantidadFeedback] = useState('')
  const [cantidadError, setCantidadError] = useState('')
  const scanBurstRef = useRef(emptyScanBurst())
  const [selectedUnitForPrint, setSelectedUnitForPrint] = useState(null)
  const unitPrintRef = useRef(null)
  const pendingPrintUnitRef = useRef(false)

  const [unitEtiquetaFilter, setUnitEtiquetaFilter] = useState('todas') // todas | impresas | no_impresas

  useEffect(() => {
    if (!currentProduct) return
    const u = currentProduct.ubicacionFisica
    setUbicacionEdit(
      UBICACION_FISICA_OPTIONS.some((o) => o.value === u) ? u : DEFAULT_UBICACION_FISICA
    )
    setDetalleUbicacionEdit(String(currentProduct.detalleUbicacion ?? ''))
    setUbicacionFeedback('')
  }, [currentProduct?.id, currentProduct?.ubicacionFisica, currentProduct?.detalleUbicacion])

  useEffect(() => {
    if (!currentProduct) return
    setCantidadEdit(String(Math.max(0, Number(currentProduct.quantity) || 0)))
    setCantidadMotivo('')
    setCantidadBarcodeScan('')
    setCantidadFeedback('')
    setCantidadError('')
    scanBurstRef.current = emptyScanBurst()
  }, [currentProduct?.id, currentProduct?.quantity])

  const skuMasterSafe = currentProduct
    ? String(currentProduct.codigoInventario ?? currentProduct.sku ?? '').trim()
    : ''

  // Hook siempre debe ejecutarse (no debe quedar condicionado por `if (!currentProduct) return null`).
  const handlePrintUnit = useReactToPrint({
    contentRef: unitPrintRef,
    documentTitle: selectedUnitForPrint
      ? `etiqueta-${selectedUnitForPrint.serial}`
      : `etiqueta-${skuMasterSafe}`,
    onAfterPrint: () => {
      const u = selectedUnitForPrint
      if (!u) return
      const key = String(u.id_unidad ?? u.id ?? '').trim()
      if (!key) return
      markUnitsPrinted([key], { actorEmail: user?.email })
    },
  })

  // Importante: esperar a que el label ya esté renderizado antes de imprimir,
  // así el SVG DataMatrix alcanza a generarse.
  useEffect(() => {
    if (!pendingPrintUnitRef.current) return
    if (!selectedUnitForPrint) return
    pendingPrintUnitRef.current = false
    handlePrintUnit()
  }, [selectedUnitForPrint, handlePrintUnit])

  if (!currentProduct) return null

  const imagenes = currentProduct.imagenesReferenciales ?? []
  const hasImagenes = Array.isArray(imagenes) && imagenes.length > 0
  const fotoCount = imagenes.length
  const skuMaster = String(currentProduct.codigoInventario ?? currentProduct.sku ?? '').trim()
  const unitRows = (unitItems || []).filter(
    (u) => String(u.sku_maestro ?? u.sku ?? '').trim() === skuMaster
  )

  const totalUnits = unitRows.length
  const labeledUnitsCount = unitRows.filter((u) => u?.etiqueta_impresa === true).length

  const filteredUnitRows = unitRows.filter((u) => {
    if (unitEtiquetaFilter === 'impresas') return u?.etiqueta_impresa === true
    if (unitEtiquetaFilter === 'no_impresas') return u?.etiqueta_impresa !== true
    return true
  })

  const handleFileChange = (e) => {
    const files = e.target.files
    if (!files?.length) return
    readFilesAsDataUrls(files).then((urls) => {
      addProductImages(currentProduct.id, urls)
    })
    e.target.value = ''
  }

  const handleGuardarUbicacion = () => {
    if (!ubicacionEdit) return
    updateProduct(currentProduct.id, {
      ubicacionFisica: ubicacionEdit,
      detalleUbicacion: detalleUbicacionEdit.trim(),
    })
    setUbicacionFeedback('Ubicación guardada.')
  }

  const barcodeOkForAdjust = isBarcodeEligibleForManualAdjust(currentProduct.barcode)

  const handleGuardarCantidad = () => {
    setCantidadError('')
    setCantidadFeedback('')
    if (!barcodeOkForAdjust) {
      setCantidadError(
        'Este bien no tiene un código de barras válido. Corrija el barcode (p. ej. vía importación) antes de usar Ajuste de Cantidad.'
      )
      return
    }
    if (!String(cantidadMotivo).trim()) {
      setCantidadError('El motivo del ajuste es obligatorio.')
      return
    }
    const nextQty = Math.max(0, Number(cantidadEdit) || 0)
    const prevQty = Math.max(0, Number(currentProduct.quantity) || 0)
    if (nextQty === prevQty) {
      setCantidadError('La cantidad es la misma que en el sistema; no se registrará movimiento.')
      return
    }
    const scanRaw = String(cantidadBarcodeScan).trim()
    if (!scanRaw) {
      setCantidadError('Enfoque el campo y escanee el código de barras del bien con el lector.')
      return
    }
    if (!isLikelyBarcodeScannerInput(scanBurstRef, scanRaw.length)) {
      setCantidadError(
        'El código debe leerse con pistola o lector de barras. No está permitido escribirlo ni pegarlo. Borre el campo y vuelva a escanear.'
      )
      return
    }
    if (!barcodesMatchForManualAdjust(currentProduct.barcode, scanRaw)) {
      setCantidadError('El código escaneado no coincide con el barcode de este bien.')
      return
    }
    updateProduct(
      currentProduct.id,
      { quantity: nextQty },
      {
        actorEmail: user?.email,
        stockChangeReason: cantidadMotivo.trim(),
        stockChangeBarcode: scanRaw,
      }
    )
    setCantidadFeedback('Ajuste de Cantidad guardado. Quedó registrado en Trazabilidad y en Historial de Actividad.')
    setCantidadMotivo('')
    setCantidadBarcodeScan('')
    scanBurstRef.current = emptyScanBurst()
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

          <div className="ficha-unidades">
            <h4 className="ficha-ubicacion__title">Unidades en Stock (Serializadas)</h4>
            <p className="ficha-ubicacion__summary" style={{ marginTop: '-0.15rem' }}>
              Unidades Etiquetadas: <strong>{labeledUnitsCount}</strong> / <strong>{totalUnits}</strong>
            </p>

            <div className="import__collab-actions" style={{ marginTop: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                className="product-list__ficha-btn"
                style={{
                  background: unitEtiquetaFilter === 'todas' ? 'rgba(100, 108, 255, 0.15)' : 'transparent',
                }}
                onClick={() => setUnitEtiquetaFilter('todas')}
              >
                Todas
              </button>
              <button
                type="button"
                className="product-list__ficha-btn"
                style={{
                  background: unitEtiquetaFilter === 'impresas' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  borderColor: unitEtiquetaFilter === 'impresas' ? 'rgb(16, 185, 129)' : undefined,
                  color: unitEtiquetaFilter === 'impresas' ? 'rgb(16, 185, 129)' : undefined,
                }}
                onClick={() => setUnitEtiquetaFilter('impresas')}
              >
                Impresas ({unitRows.filter((u) => u?.etiqueta_impresa === true).length})
              </button>
              <button
                type="button"
                className="product-list__ficha-btn"
                style={{
                  background:
                    unitEtiquetaFilter === 'no_impresas' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                }}
                onClick={() => setUnitEtiquetaFilter('no_impresas')}
              >
                No impresas ({unitRows.filter((u) => u?.etiqueta_impresa !== true).length})
              </button>
            </div>

            {unitRows.length === 0 ? (
              <p className="ficha-ubicacion__summary">No hay unidades serializadas para este SKU.</p>
            ) : (
              <div className="product-table-wrapper" style={{ marginTop: '0.75rem' }}>
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>ID Unidad</th>
                      <th>Serial</th>
                      <th>Estado</th>
                      <th>Etiqueta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnitRows.map((u) => (
                      <tr key={u.id_unidad ?? u.id}>
                        <td>{u.id_unidad}</td>
                        <td>{u.serial}</td>
                        <td>{u.estado ?? u.status ?? '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="product-list__ficha-btn"
                            style={{ width: '100%', textAlign: 'center', padding: '0.6rem 0.75rem' }}
                            onClick={() => {
                              setSelectedUnitForPrint(u)
                              setPendingPrintUnit(true)
                            }}
                          >
                            Imprimir etiqueta
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUnitRows.length === 0 ? (
                  <p className="ficha-ubicacion__summary" style={{ marginTop: '0.75rem' }}>
                    No hay unidades para este filtro.
                  </p>
                ) : null}
              </div>
            )}
            <div className="ficha-unit-print-hide">
              {selectedUnitForPrint && (
                <div ref={unitPrintRef}>
                  <PrintableLabel item={selectedUnitForPrint} />
                </div>
              )}
            </div>
          </div>

          <div className="ficha-ubicacion ficha-cantidad-stock">
            <h4 className="ficha-ubicacion__title">Ajuste de Cantidad</h4>
            <p className="ficha-ubicacion__summary">
              <span className="ficha-ubicacion__summary-label">Cantidad en sistema:</span>{' '}
              {Math.max(0, Number(currentProduct.quantity) || 0)} uds.
            </p>
            {!barcodeOkForAdjust ? (
              <p className="ficha-cantidad-stock__error" role="alert">
                No se puede usar Ajuste de Cantidad: el bien no tiene un código de barras válido en el sistema. Actualice
                el inventario (p. ej. importación CSV) para asignar un barcode antes de ajustar stock desde aquí.
              </p>
            ) : (
              <p className="ficha-cantidad-stock__hint">
                Indique motivo y confirme con el <strong>lector de barras</strong> (pistola). No pegue ni escriba el código:
                el sistema solo acepta lectura escaneada.
              </p>
            )}
            <div className="ficha-ubicacion__fields">
              <label className="ficha-ubicacion__label" htmlFor="ficha-cantidad-input">
                Nueva cantidad <span className="ficha-ubicacion__req">*</span>
              </label>
              <input
                id="ficha-cantidad-input"
                type="number"
                min={0}
                step={1}
                className="ficha-ubicacion__select ficha-cantidad-stock__input"
                value={cantidadEdit}
                disabled={!barcodeOkForAdjust}
                onChange={(e) => {
                  setCantidadEdit(e.target.value)
                  setCantidadBarcodeScan('')
                  scanBurstRef.current = emptyScanBurst()
                  setCantidadError('')
                  setCantidadFeedback('')
                }}
                aria-required
              />

              <label className="ficha-ubicacion__label" htmlFor="ficha-cantidad-motivo">
                Motivo del ajuste <span className="ficha-ubicacion__req">*</span>
              </label>
              <textarea
                id="ficha-cantidad-motivo"
                className="ficha-ubicacion__textarea"
                value={cantidadMotivo}
                disabled={!barcodeOkForAdjust}
                onChange={(e) => {
                  setCantidadMotivo(e.target.value)
                  setCantidadError('')
                  setCantidadFeedback('')
                }}
                placeholder="Ej. Corrección inventario físico, conteo cíclico, error de carga…"
                rows={2}
                required
              />

              <label className="ficha-ubicacion__label" htmlFor="ficha-cantidad-barcode-scan">
                Confirmar con código de barras (escaneo) <span className="ficha-ubicacion__req">*</span>
              </label>
              <input
                id="ficha-cantidad-barcode-scan"
                type="text"
                inputMode="none"
                autoComplete="off"
                spellCheck={false}
                className="ficha-ubicacion__select ficha-cantidad-stock__input-barcode"
                value={cantidadBarcodeScan}
                disabled={!barcodeOkForAdjust}
                onBeforeInput={(e) => {
                  if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
                    e.preventDefault()
                    setCantidadError('No pegue ni arrastre el código. Use el lector de barras.')
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault()
                  setCantidadError('No está permitido pegar el código. Escaneéelo con el lector.')
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setCantidadError('No arrastre texto al campo. Use el lector de barras.')
                }}
                onChange={(e) => {
                  const v = e.target.value
                  const prev = cantidadBarcodeScan
                  const now = Date.now()

                  if (v.length < prev.length) {
                    setCantidadBarcodeScan('')
                    scanBurstRef.current = emptyScanBurst()
                    setCantidadError('Si corrige el código, debe volver a escanearlo por completo con el lector.')
                    setCantidadFeedback('')
                    return
                  }

                  const added = v.length - prev.length
                  if (added > 1) {
                    setCantidadBarcodeScan('')
                    scanBurstRef.current = emptyScanBurst()
                    setCantidadError('No pegue el código. Enfoque el campo y escanéelo de una sola vez con el lector.')
                    setCantidadFeedback('')
                    return
                  }

                  if (v === '') {
                    scanBurstRef.current = emptyScanBurst()
                  } else if (v.length === 1) {
                    scanBurstRef.current = {
                      firstAt: now,
                      lastAt: now,
                      maxGapMs: 0,
                      prevKeyAt: now,
                    }
                  } else {
                    const r = scanBurstRef.current
                    const prevKey = r.prevKeyAt
                    if (prevKey != null) {
                      r.maxGapMs = Math.max(r.maxGapMs, now - prevKey)
                    }
                    r.prevKeyAt = now
                    r.lastAt = now
                    if (r.firstAt == null) r.firstAt = now
                  }

                  setCantidadBarcodeScan(v)
                  setCantidadError('')
                  setCantidadFeedback('')
                }}
                placeholder="Enfocar aquí y escanear con el lector"
                aria-required
                aria-describedby="ficha-cantidad-barcode-scan-hint"
              />
              <p id="ficha-cantidad-barcode-scan-hint" className="ficha-cantidad-stock__hint ficha-cantidad-stock__hint--field">
                Solo lectura por pistola/lector USB o Bluetooth; sin teclado ni pegar.
              </p>

              {cantidadError ? (
                <p className="ficha-cantidad-stock__error" role="alert">
                  {cantidadError}
                </p>
              ) : null}

              <div className="ficha-ubicacion__actions">
                <button
                  type="button"
                  className="ficha-ubicacion__btn"
                  onClick={handleGuardarCantidad}
                  disabled={!barcodeOkForAdjust}
                >
                  Confirmar ajuste
                </button>
                {cantidadFeedback ? (
                  <span className="ficha-ubicacion__feedback" role="status">
                    {cantidadFeedback}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="ficha-ubicacion">
            <h4 className="ficha-ubicacion__title">Ubicación Física</h4>
            <p className="ficha-ubicacion__summary">
              <span className="ficha-ubicacion__summary-label">Ubicación Física:</span>{' '}
              {labelUbicacionFisica(currentProduct.ubicacionFisica)}
            </p>
            {currentProduct.detalleUbicacion?.trim() ? (
              <p className="ficha-ubicacion__summary">
                <span className="ficha-ubicacion__summary-label">Detalle de ubicación:</span>{' '}
                {currentProduct.detalleUbicacion}
              </p>
            ) : null}

            <div className="ficha-ubicacion__fields">
              <label className="ficha-ubicacion__label" htmlFor="ficha-ubicacion-select">
                Bodega <span className="ficha-ubicacion__req">*</span>
              </label>
              <select
                id="ficha-ubicacion-select"
                className="ficha-ubicacion__select"
                value={ubicacionEdit}
                onChange={(e) => {
                  setUbicacionEdit(e.target.value)
                  setUbicacionFeedback('')
                }}
                required
              >
                {UBICACION_FISICA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <label className="ficha-ubicacion__label" htmlFor="ficha-ubicacion-detalle">
                Detalle de ubicación <span className="ficha-ubicacion__optional">(opcional)</span>
              </label>
              <textarea
                id="ficha-ubicacion-detalle"
                className="ficha-ubicacion__textarea"
                value={detalleUbicacionEdit}
                onChange={(e) => {
                  setDetalleUbicacionEdit(e.target.value)
                  setUbicacionFeedback('')
                }}
                placeholder="Estante, pasillo, nivel u observaciones"
                rows={3}
              />

              <div className="ficha-ubicacion__actions">
                <button type="button" className="ficha-ubicacion__btn" onClick={handleGuardarUbicacion}>
                  Guardar ubicación
                </button>
                {ubicacionFeedback ? (
                  <span className="ficha-ubicacion__feedback" role="status">
                    {ubicacionFeedback}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      <button type="button" className="ficha-tecnica-overlay__backdrop" onClick={onClose} aria-label="Cerrar" />
    </div>
  )
}

export default FichaTecnicaModal
