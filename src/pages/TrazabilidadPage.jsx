import { useState } from 'react'
import { useInventory } from '../context/InventoryContext'
import { useAuth } from '../context/AuthContext'
import {
  MOVEMENT_CATEGORIES,
  MOVEMENT_TYPE_LABELS,
  getMovementSign,
  isReasonRequired,
} from '../types/movement'

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

const TrazabilidadPage = () => {
  const { user } = useAuth()
  const { products, movements, addMovement, registerReturnNewSku, logAuditEvent } = useInventory()
  const [productId, setProductId] = useState('')
  const [type, setType] = useState(DEFAULT_TYPE)
  const [quantityInput, setQuantityInput] = useState('')
  const [newSkuCode, setNewSkuCode] = useState('')
  const [newSkuName, setNewSkuName] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(() => getChileNowForInput())
  const [validationError, setValidationError] = useState('')

  const responsibleDisplay = user?.email ? `Usuario Autenticado: ${user.email}` : 'Usuario Autenticado: Felipe Rebolledo'
  const reasonRequired = isReasonRequired(type)
  const isEntrada = getMovementSign(type) === 'entrada'
  const isNewSkuMode = productId === NEW_SKU_VALUE

  const handleSubmit = (e) => {
    e.preventDefault()
    setValidationError('')

    if (reasonRequired && !String(reason || '').trim()) {
      setValidationError('El motivo es obligatorio para este tipo de movimiento.')
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
        reason: String(reason || '').trim() || '—',
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
        detalle: `Movimiento "${MOVEMENT_TYPE_LABELS[type]}" sobre "${product.name}" (${product.codigoInventario ?? product.sku ?? 'sin código'}) por ${effectiveDelta} unidades.`,
        productoId: product.id,
        sku: product.codigoInventario ?? product.sku,
        estadoAnterior: before,
        estadoNuevo: after,
        reversible: true,
      })
    }

    setQuantityInput('')
    setReason('')
    setDate(getChileNowForInput())
  }

  const quantityMessage = getQuantityMessage(type, quantityInput)
  const sortedMovements = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="page trazabilidad-page">
      <section className="trazabilidad">
        <h2 className="trazabilidad__title">Gestor de Trazabilidad</h2>
        <p className="trazabilidad__subtitle">
          Registro histórico de movimientos de unidades. Cada movimiento tiene responsable, fecha y motivo.
        </p>

        <div className="trazabilidad__form-block bg-white/10 rounded-xl border border-slate-500/50 p-8 shadow-lg text-base">
          <h3 className="trazabilidad__form-title text-xl font-semibold text-slate-100 mb-5">
            Registrar movimiento
          </h3>
          <form className="trazabilidad__form space-y-5 max-w-xl" onSubmit={handleSubmit}>
            <div>
              <label className="block text-base font-medium text-slate-200 mb-2">Producto</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full text-lg rounded-lg border border-slate-400 bg-slate-100 text-slate-900 px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  <label className="block text-base font-medium text-slate-200 mb-2">Código (SKU) *</label>
                  <input
                    type="text"
                    value={newSkuCode}
                    onChange={(e) => setNewSkuCode(e.target.value)}
                    className="w-full text-lg rounded-lg border border-slate-400 bg-slate-100 text-slate-900 px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ej. INV-RET-2026-001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-slate-200 mb-2">Nombre del activo</label>
                  <input
                    type="text"
                    value={newSkuName}
                    onChange={(e) => setNewSkuName(e.target.value)}
                    className="w-full text-lg rounded-lg border border-slate-400 bg-slate-100 text-slate-900 px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ej. Equipo devuelto por cliente"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-base font-medium text-slate-200 mb-2">Tipo de movimiento</label>
              <select
                value={type}
                onChange={(e) => {
                  const newType = e.target.value
                  setType(newType)
                  if (getMovementSign(newType) !== 'entrada' && productId === NEW_SKU_VALUE) {
                    setProductId('')
                    setNewSkuCode('')
                    setNewSkuName('')
                  }
                }}
                className="w-full text-lg rounded-lg border border-slate-400 bg-slate-100 text-slate-900 px-4 py-3 focus:ring-2 focus:ring-indigo-500"
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

            {!isNewSkuMode && (
            <div>
              <label className="block text-base font-medium text-slate-200 mb-2">
                Cantidad {getMovementSign(type) === 'interno' && '(positivo o negativo)'}
              </label>
              <input
                type="number"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                className="w-full text-lg rounded-lg border border-slate-400 bg-slate-100 text-slate-900 px-4 py-3 focus:ring-2 focus:ring-indigo-500"
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
              <label className="block text-base font-medium text-slate-200 mb-2">Responsable</label>
              <span
                className="inline-block w-full text-lg rounded-lg border border-slate-500 bg-slate-700/50 text-slate-200 px-4 py-3"
                aria-readonly="true"
              >
                {responsibleDisplay}
              </span>
            </div>

            <div>
              <label className="block text-base font-medium text-slate-200 mb-2">Fecha y hora</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-lg rounded-lg border border-slate-400 bg-slate-100 text-slate-900 px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-base font-medium text-slate-200 mb-2">
                Motivo {reasonRequired && <span className="text-red-400">*</span>}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-lg rounded-lg border border-slate-400 bg-slate-100 text-slate-900 px-4 py-3 min-h-[88px] focus:ring-2 focus:ring-indigo-500"
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

        <div className="trazabilidad__history mt-8">
          <h3 className="trazabilidad__history-title">Historial de movimientos</h3>
          {sortedMovements.length === 0 ? (
            <p className="trazabilidad__empty">Aún no hay movimientos. Los cambios desde CSV no se registran aquí.</p>
          ) : (
            <div className="trazabilidad__table-wrap">
              <table className="trazabilidad__table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto / Código</th>
                    <th>Tipo</th>
                    <th>Variación</th>
                    <th>Stock después</th>
                    <th>Responsable</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMovements.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDate(m.date)}</td>
                      <td>
                        {m.productName} <span className="trazabilidad__codigo">({m.codigoInventario})</span>
                      </td>
                      <td>{MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</td>
                      <td className={m.quantityDelta > 0 ? 'trazabilidad__delta--pos' : 'trazabilidad__delta--neg'}>
                        {m.quantityDelta > 0 ? '+' : ''}{m.quantityDelta}
                      </td>
                      <td>{m.quantityAfter}</td>
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
