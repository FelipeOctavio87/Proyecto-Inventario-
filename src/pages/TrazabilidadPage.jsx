import { useMemo, useState } from 'react'
import { useInventory } from '../context/InventoryContext'
import { useAuth } from '../context/AuthContext'
import {
  MOVEMENT_CATEGORIES,
  MOVEMENT_TYPE_LABELS,
  getMovementOriginLabel,
  getMovementSign,
  isReasonRequired,
} from '../types/movement'
import AjustePorEscaneo from '../components/AjustePorEscaneo'
import { normalizeBarcodeForComparison } from '../utils/barcodeManualAdjust'

const CHILE_TZ = 'America/Santiago'

/** Hora actual en Chile en formato para input datetime-local */
const getChileNowForInput = () => {
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Stock antes → después; movimientos viejos sin `quantityBefore` usan derivación. */
const formatStockBeforeAfter = (m) => {
  const after = Number(m.quantityAfter) || 0
  const delta = Number(m.quantityDelta) || 0
  const before =
    m.quantityBefore != null && m.quantityBefore !== ''
      ? Number(m.quantityBefore) || 0
      : after - delta
  return `${before} → ${after}`
}

const formatDate = (iso) => {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: CHILE_TZ,
    })
  } catch {
    return iso
  }
}

/**
 * Fecha calendario YYYY-MM-DD en zona Chile para un instante ISO.
 * Devuelve null si la fecha es inválida (evita RangeError en formatToParts y pantalla en blanco).
 */
const toChileYmd = (dateInput) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(d.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: CHILE_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value
    const mo = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (!y || !mo || !day) return null
    return `${y}-${mo}-${day}`
  } catch {
    return null
  }
}

/** Suma días a un YYYY-MM-DD (calendario gregoriano) y devuelve el YMD en Chile de ese instante. */
const addDaysToYmd = (ymd, deltaDays) => {
  if (!ymd || typeof ymd !== 'string') return null
  const [y, mo, da] = ymd.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return null
  const t = new Date(Date.UTC(y, mo - 1, da + deltaDays, 12, 0, 0))
  return toChileYmd(t)
}

const getDefaultLast7DaysRange = () => {
  const hasta = toChileYmd(new Date()) ?? new Date().toISOString().slice(0, 10)
  const desde = addDaysToYmd(hasta, -6) ?? hasta
  return { desde, hasta }
}

/** Primer tipo por defecto (Recepción de Proveedor) */
const DEFAULT_TYPE = MOVEMENT_CATEGORIES.ENTRADAS.types[0].value

/** Calcula el delta efectivo según categoría: entrada siempre +, salida siempre -, interno como ingresa */
function getEffectiveDelta(typeValue, inputQuantity) {
  const num = Math.abs(Number(inputQuantity)) || 0
  if (num === 0) return 0
  const sign = getMovementSign(typeValue)
  if (sign === 'entrada') return num
  if (sign === 'salida') return -num
  return Number(inputQuantity)
}

/** Mensaje dinámico según tipo */
function getQuantityMessage(typeValue, quantity) {
  const q = Math.abs(Number(quantity)) || 0
  if (q === 0) return null
  const sign = getMovementSign(typeValue)
  if (sign === 'entrada') return `Este movimiento sumará ${q} unidad${q !== 1 ? 'es' : ''} al stock actual.`
  if (sign === 'salida') return `Este movimiento restará ${q} unidad${q !== 1 ? 'es' : ''} al stock actual.`
  const n = Number(quantity)
  if (n > 0) return `Este movimiento sumará ${n} unidad${n !== 1 ? 'es' : ''} al stock actual.`
  if (n < 0) return `Este movimiento restará ${Math.abs(n)} unidad${Math.abs(n) !== 1 ? 'es' : ''} al stock actual.`
  return null
}

/** Clase del botón según categoría del tipo */
function getSubmitButtonClass(typeValue) {
  const sign = getMovementSign(typeValue)
  const base = 'trazabilidad__btn w-full sm:w-auto font-semibold rounded-lg px-5 py-2.5 transition-colors'
  if (sign === 'entrada') return `${base} bg-green-600 hover:bg-green-700 text-white`
  if (sign === 'salida') return `${base} bg-red-600 hover:bg-red-700 text-white`
  return `${base} bg-slate-600 hover:bg-slate-700 text-white`
}

const NEW_SKU_VALUE = '__new__'
const RETAIL_OPTIONS = ['Falabella', 'Paris', 'Ripley', 'Walmart', 'Mercado Libre', 'Hites']

const isRetailRequiredForType = (typeValue) =>
  typeValue === 'venta' || typeValue === 'devolucion_cliente_retail'

const TrazabilidadPage = () => {
  const { user } = useAuth()
  const { products, movements, addMovement, registerReturnNewSku, logAuditEvent } = useInventory()
  const [productId, setProductId] = useState('')
  const [type, setType] = useState(DEFAULT_TYPE)
  const [quantityInput, setQuantityInput] = useState('')
  const [newSkuCode, setNewSkuCode] = useState('')
  const [newSkuName, setNewSkuName] = useState('')
  const [reason, setReason] = useState('')
  const [retail, setRetail] = useState('')
  const [date, setDate] = useState(() => getChileNowForInput())
  const [validationError, setValidationError] = useState('')

  const [movementSearch, setMovementSearch] = useState('')
  const [dateDesde, setDateDesde] = useState(() => getDefaultLast7DaysRange().desde)
  const [dateHasta, setDateHasta] = useState(() => getDefaultLast7DaysRange().hasta)
  const [dateFilterAll, setDateFilterAll] = useState(false)
  const [movementTypeFilter, setMovementTypeFilter] = useState('')

  const safeMovements = Array.isArray(movements) ? movements : []

  const responsibleDisplay = user?.email ? `Usuario Autenticado: ${user.email}` : 'Usuario Autenticado: Felipe Rebolledo'
  const reasonRequired = isReasonRequired(type)
  const retailRequired = isRetailRequiredForType(type)
  const isEntrada = getMovementSign(type) === 'entrada'
  const isNewSkuMode = productId === NEW_SKU_VALUE

  const handleSubmit = (e) => {
    e.preventDefault()
    setValidationError('')

    if (reasonRequired && !String(reason || '').trim()) {
      setValidationError('El motivo es obligatorio para este tipo de movimiento.')
      return
    }
    if (retailRequired && !String(retail || '').trim()) {
      setValidationError('Debe seleccionar un Retail para Venta o Devolución.')
      return
    }

    if (isNewSkuMode) {
      const sku = String(newSkuCode || '').trim()
      const name = String(newSkuName || '').trim() || sku
      if (!sku) {
        setValidationError('Ingrese el código (SKU) del nuevo activo.')
        return
      }
      const existing = products.find(
        (p) => (p.codigoInventario ?? p.sku ?? '').toString().trim().toLowerCase() === sku.toLowerCase()
      )
      if (existing) {
        setValidationError('Ese SKU ya existe. Use "Seleccionar bien" y elija el producto para registrar la devolución.')
        return
      }
      const result = registerReturnNewSku({
        codigoInventario: sku,
        name,
        type,
        responsible: responsibleDisplay,
        reason: `${String(reason || '').trim() || '—'}${retailRequired ? ` · Retail: ${retail}` : ''}`,
        date: date ? new Date(date).toISOString() : undefined,
      })
      if (result) {
        logAuditEvent({
          usuario: responsibleDisplay,
          accion: 'Alta de activo por devolución',
          actionType: 'STOCK_ADJUST',
          targetSku: result.codigoInventario,
          previousValue: 0,
          newValue: 1,
          detalle: `Nuevo activo "${result.productName}" (${result.codigoInventario}) creado por movimiento "${MOVEMENT_TYPE_LABELS[type] ?? type}".`,
          productoId: result.newId,
          sku: result.codigoInventario,
          estadoAnterior: { quantity: 0, version: 1 },
          estadoNuevo: { quantity: 1, version: 1 },
          reversible: true,
        })
      }
      setProductId('')
      setNewSkuCode('')
      setNewSkuName('')
      setReason('')
      setRetail('')
      setDate(getChileNowForInput())
      return
    }

    const pid = Number(productId)
    if (!pid) {
      setValidationError('Seleccione un producto o registre un SKU nuevo.')
      return
    }

    const effectiveDelta = getEffectiveDelta(type, quantityInput)
    if (effectiveDelta === 0) {
      setValidationError('Ingrese una cantidad válida.')
      return
    }

    const product = products.find((p) => p.id === pid)

    addMovement(pid, {
      type,
      delta: effectiveDelta,
      responsible: responsibleDisplay,
      reason: String(reason || '').trim() || '—',
      retail: retailRequired ? retail : null,
      date: date ? new Date(date).toISOString() : undefined,
    })

    if (product) {
      const currentQty = Number(product.quantity) || 0
      const afterQty = Math.max(0, currentQty + effectiveDelta)
      const baseVersion = Number(product.version) || 1
      const before = {
        quantity: currentQty,
        version: baseVersion,
      }
      const after = {
        quantity: afterQty,
        version: baseVersion + 1,
      }
      logAuditEvent({
        usuario: responsibleDisplay,
        accion: 'Ajuste de Stock',
        actionType: 'STOCK_ADJUST',
        targetSku: product.codigoInventario ?? product.sku,
        previousValue: currentQty,
        newValue: afterQty,
        detalle: `Movimiento "${MOVEMENT_TYPE_LABELS[type]}" sobre "${product.name}" (${product.codigoInventario ?? product.sku ?? 'sin código'}) por ${effectiveDelta} unidades.${retailRequired ? ` Retail: ${retail}.` : ''}`,
        productoId: product.id,
        sku: product.codigoInventario ?? product.sku,
        estadoAnterior: before,
        estadoNuevo: after,
        reversible: true,
      })
    }

    setQuantityInput('')
    setReason('')
    setRetail('')
    setDate(getChileNowForInput())
  }

  const quantityMessage = getQuantityMessage(type, quantityInput)

  const productById = useMemo(() => {
    const map = new Map()
    products.forEach((p) => map.set(p.id, p))
    return map
  }, [products])

  const movementTypesUnknownInCatalog = useMemo(() => {
    const known = new Set(Object.keys(MOVEMENT_TYPE_LABELS))
    const found = new Set()
    safeMovements.forEach((m) => {
      const t = m?.type
      if (t != null && String(t) !== '' && !known.has(String(t))) found.add(String(t))
    })
    return [...found].sort((a, b) => a.localeCompare(b, 'es'))
  }, [safeMovements])

  const movementTypeOptionsSorted = useMemo(
    () =>
      Object.entries(MOVEMENT_TYPE_LABELS).sort((a, b) =>
        a[1].localeCompare(b[1], 'es', { sensitivity: 'base' })
      ),
    []
  )

  const filteredMovements = useMemo(() => {
    let list = safeMovements

    if (!dateFilterAll && dateDesde && dateHasta) {
      const desdeEff = dateDesde <= dateHasta ? dateDesde : dateHasta
      const hastaEff = dateDesde <= dateHasta ? dateHasta : dateDesde
      list = list.filter((m) => {
        const ymd = toChileYmd(m.date)
        if (ymd == null) return true
        return ymd >= desdeEff && ymd <= hastaEff
      })
    }

    const qRaw = movementSearch.trim()
    if (qRaw) {
      const qLower = qRaw.toLowerCase()
      const qBarcode = normalizeBarcodeForComparison(qRaw)
      list = list.filter((m) => {
        const codigo = String(m.codigoInventario ?? '').toLowerCase()
        const nombre = String(m.productName ?? '').toLowerCase()
        if (codigo.includes(qLower) || nombre.includes(qLower)) return true
        const prod = m.productId != null ? productById.get(m.productId) : null
        if (!prod?.barcode || !qBarcode) return false
        const bNorm = normalizeBarcodeForComparison(prod.barcode)
        return bNorm.includes(qBarcode)
      })
    }

    if (movementTypeFilter) {
      list = list.filter((m) => String(m.type ?? '') === movementTypeFilter)
    }

    return [...list].sort((a, b) => {
      const ta = new Date(a.date).getTime()
      const tb = new Date(b.date).getTime()
      const aOk = Number.isFinite(ta)
      const bOk = Number.isFinite(tb)
      if (!aOk && !bOk) return 0
      if (!aOk) return 1
      if (!bOk) return -1
      return tb - ta
    })
  }, [
    safeMovements,
    dateFilterAll,
    dateDesde,
    dateHasta,
    movementSearch,
    movementTypeFilter,
    productById,
  ])

  const totalMovements = safeMovements.length
  const shownCount = filteredMovements.length

  return (
    <div className="page trazabilidad-page">
      <section className="trazabilidad">
        <h2 className="product-list__title">Gestor de Trazabilidad</h2>
        <p className="product-list__subtitle">
          Registro histórico de movimientos de unidades. Cada movimiento tiene responsable, fecha y motivo.
        </p>

        <div className="trazabilidad__form-block product-list__filter-card">
          <h3 className="trazabilidad__form-title">
            Registrar movimiento
          </h3>
          <form className="trazabilidad__form space-y-5 max-w-xl" onSubmit={handleSubmit}>
            <div>
              <label className="product-list__filter-label" htmlFor="traz-producto">
                Producto
              </label>
              <select
                id="traz-producto"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="product-list__filter-select"
                required={!isNewSkuMode}
              >
                <option value="">Seleccionar bien</option>
                {isEntrada && (
                  <option value={NEW_SKU_VALUE}>➕ Devolución / entrada — SKU nuevo (crear activo)</option>
                )}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.codigoInventario ?? p.sku}) — {Number(p.quantity) || 0} uds.
                  </option>
                ))}
              </select>
            </div>

            {isNewSkuMode && (
              <div className="trazabilidad__new-sku-fields space-y-4 rounded-lg border border-amber-500/50 bg-amber-900/20 p-4">
                <p className="text-sm font-medium text-amber-200">
                  El activo no existe en el listado. Se creará un nuevo registro con 1 unidad.
                </p>
                <div>
                  <label className="product-list__filter-label" htmlFor="traz-new-sku">
                    Código (SKU) *
                  </label>
                  <input
                    id="traz-new-sku"
                    type="text"
                    value={newSkuCode}
                    onChange={(e) => setNewSkuCode(e.target.value)}
                    className="product-list__filter-input"
                    placeholder="Ej. INV-RET-2026-001"
                    required
                  />
                </div>
                <div>
                  <label className="product-list__filter-label" htmlFor="traz-new-name">
                    Nombre del activo
                  </label>
                  <input
                    id="traz-new-name"
                    type="text"
                    value={newSkuName}
                    onChange={(e) => setNewSkuName(e.target.value)}
                    className="product-list__filter-input"
                    placeholder="Ej. Equipo devuelto por cliente"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="product-list__filter-label" htmlFor="traz-tipo-mov">
                Tipo de movimiento
              </label>
              <select
                id="traz-tipo-mov"
                value={type}
                onChange={(e) => {
                  const newType = e.target.value
                  setType(newType)
                  if (!isRetailRequiredForType(newType)) setRetail('')
                  if (getMovementSign(newType) !== 'entrada' && productId === NEW_SKU_VALUE) {
                    setProductId('')
                    setNewSkuCode('')
                    setNewSkuName('')
                  }
                }}
                className="product-list__filter-select"
              >
                {Object.entries(MOVEMENT_CATEGORIES).map(([key, cat]) => (
                  <optgroup key={key} label={cat.label}>
                    {cat.types.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {retailRequired && (
              <div>
                <label className="product-list__filter-label" htmlFor="traz-retail">
                  Retail <span className="text-red-400">*</span>
                </label>
                <select
                  id="traz-retail"
                  value={retail}
                  onChange={(e) => setRetail(e.target.value)}
                  className="product-list__filter-select"
                  required
                >
                  <option value="">Seleccionar Retail</option>
                  {RETAIL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}

            {!isNewSkuMode && (
            <div>
              <label className="product-list__filter-label" htmlFor="traz-cantidad">
                Cantidad {getMovementSign(type) === 'interno' && '(positivo o negativo)'}
              </label>
              <input
                id="traz-cantidad"
                type="number"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                className="product-list__filter-input"
                placeholder={
                  getMovementSign(type) === 'interno'
                    ? 'Ej. 2 o -1'
                    : 'Solo valor numérico (el sistema aplica el signo)'
                }
                required
              />
              {quantityMessage && (
                <p className="mt-2 text-base text-amber-200 font-medium" role="status">
                  {quantityMessage}
                </p>
              )}
            </div>
            )}

            <div>
              <label className="product-list__filter-label">Responsable</label>
              <span
                className="product-list__filter-input trazabilidad__responsable"
                aria-readonly="true"
              >
                {responsibleDisplay}
              </span>
            </div>

            <div>
              <label className="product-list__filter-label" htmlFor="traz-fecha">
                Fecha y hora
              </label>
              <input
                id="traz-fecha"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="product-list__filter-input"
                required
              />
            </div>

            <div>
              <label className="product-list__filter-label" htmlFor="traz-motivo">
                Motivo {reasonRequired && <span className="text-red-400">*</span>}
              </label>
              <textarea
                id="traz-motivo"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="product-list__filter-input trazabilidad__textarea"
                placeholder="Motivo del movimiento"
                rows={2}
                required={reasonRequired}
              />
            </div>

            {validationError && (
              <p className="text-base text-red-300 font-medium" role="alert">
                {validationError}
              </p>
            )}

            <button type="submit" className={`${getSubmitButtonClass(type)} text-base py-3 px-6`}>
              Registrar movimiento
            </button>
          </form>
        </div>

        <AjustePorEscaneo />

        <div className="trazabilidad__history mt-8">
          <h3 className="trazabilidad__history-title">Historial de movimientos</h3>

          <div className="trazabilidad__filters product-list__filter-card" aria-label="Filtros del historial">
            <div className="trazabilidad__filters-row">
              <label className="product-list__filter-label" htmlFor="traz-busqueda">
                Buscar
              </label>
              <input
                id="traz-busqueda"
                type="search"
                className="product-list__filter-input trazabilidad__filters-search"
                placeholder="Código, nombre o barcode…"
                value={movementSearch}
                onChange={(e) => setMovementSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="trazabilidad__filters-row">
              <label className="product-list__filter-label" htmlFor="traz-tipo">
                Tipo de movimiento
              </label>
              <select
                id="traz-tipo"
                className="product-list__filter-select trazabilidad__filters-type"
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                {movementTypeOptionsSorted.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
                {movementTypesUnknownInCatalog.map((t) => (
                  <option key={`unknown-${t}`} value={t}>
                    {t} (sin catálogo)
                  </option>
                ))}
              </select>
            </div>
            <div className="trazabilidad__filters-row trazabilidad__filters-row--dates">
              <div className="trazabilidad__filters-date">
                <label className="product-list__filter-label" htmlFor="traz-desde">
                  Desde
                </label>
                <input
                  id="traz-desde"
                  type="date"
                  className="product-list__filter-input"
                  value={dateDesde}
                  disabled={dateFilterAll}
                  onChange={(e) => {
                    setDateDesde(e.target.value)
                    setDateFilterAll(false)
                  }}
                />
              </div>
              <div className="trazabilidad__filters-date">
                <label className="product-list__filter-label" htmlFor="traz-hasta">
                  Hasta
                </label>
                <input
                  id="traz-hasta"
                  type="date"
                  className="product-list__filter-input"
                  value={dateHasta}
                  disabled={dateFilterAll}
                  onChange={(e) => {
                    setDateHasta(e.target.value)
                    setDateFilterAll(false)
                  }}
                />
              </div>
              <div className="trazabilidad__filters-actions">
                {dateFilterAll ? (
                  <button
                    type="button"
                    className="trazabilidad__filters-btn"
                    onClick={() => {
                      const r = getDefaultLast7DaysRange()
                      setDateDesde(r.desde)
                      setDateHasta(r.hasta)
                      setDateFilterAll(false)
                    }}
                  >
                    Últimos 7 días
                  </button>
                ) : (
                  <button
                    type="button"
                    className="trazabilidad__filters-btn"
                    onClick={() => setDateFilterAll(true)}
                  >
                    Ver todo
                  </button>
                )}
              </div>
            </div>
            <p className="trazabilidad__filters-count" role="status">
              Mostrando {shownCount} de {totalMovements} movimientos
              {dateFilterAll ? ' (sin filtro de fechas)' : ''}
            </p>
          </div>

          {totalMovements === 0 ? (
            <p className="trazabilidad__empty">
              Aún no hay movimientos. Regístralos aquí o vía importación CSV en modo actualización masiva.
            </p>
          ) : shownCount === 0 ? (
            <p className="trazabilidad__empty">
              No hay movimientos que coincidan con la búsqueda, el rango de fechas o el tipo seleccionado. Ajusta los
              filtros o usa «Ver todo».
            </p>
          ) : (
            <div className="product-table-wrapper">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>SKU</th>
                    <th>Tipo</th>
                    <th>Origen</th>
                    <th>Retail</th>
                    <th>Variación</th>
                    <th>Stock (antes → después)</th>
                    <th>Responsable</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDate(m.date)}</td>
                      <td>{m.productName}</td>
                      <td className="trazabilidad__sku-cell">{m.codigoInventario ?? '—'}</td>
                      <td>{MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</td>
                      <td className="trazabilidad__origin">{getMovementOriginLabel(m)}</td>
                      <td>{m.retail ?? '—'}</td>
                      <td className={m.quantityDelta > 0 ? 'trazabilidad__delta--pos' : 'trazabilidad__delta--neg'}>
                        {m.quantityDelta > 0 ? '+' : ''}{m.quantityDelta}
                      </td>
                      <td className="trazabilidad__stock-range">{formatStockBeforeAfter(m)}</td>
                      <td>{m.responsible}</td>
                      <td>{m.reason}</td>
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

export default TrazabilidadPage
