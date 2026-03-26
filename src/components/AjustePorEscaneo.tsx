import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useInventory } from '../context/InventoryContext'
import { useAuth } from '../context/AuthContext'
import { useBarcodeListener } from '../hooks/useBarcodeListener'
import {
  fetchProductByBarcode,
  postAjustePorEscaneo,
  type BarcodeLookupResponse,
  type AjustePorEscaneoPayload,
} from '../api/trazabilidadScanApi'
import { parseGs1LikeDataMatrix } from '../utils/datamatrixUnit'

const MOTIVO_OPTIONS = [
  { id: 'venta_retail', label: 'Venta retail' },
  { id: 'devolucion', label: 'Devolución' },
  { id: 'perdida', label: 'Pérdida' },
  { id: 'ajuste_interno', label: 'Ajuste interno' },
  { id: 'error_inventario', label: 'Error de inventario' },
  { id: 're_etiquetado', label: 'Re-etiquetado' },
  { id: 'otro', label: 'Otro' },
] as const

type MotivoId = (typeof MOTIVO_OPTIONS)[number]['id']

const RETAIL_OPTIONS = [
  'Falabella',
  'Mercado Libre',
  'Walmart',
  'Ripley',
  'Paris',
  'Mercado Público',
  'Hites',
  'Otro',
] as const

type RetailChoice = (typeof RETAIL_OPTIONS)[number]

type ProductoEscaneado = BarcodeLookupResponse & { barcode: string }

const inputClass = 'product-list__filter-input'

export default function AjustePorEscaneo() {
  const { user } = useAuth()
  const { products, addMovement, logAuditEvent, unitItems, getAvailableUnitsBySku, updateUnitStatus } = useInventory()

  const [producto, setProducto] = useState<ProductoEscaneado | null>(null)
  const [loadingLookup, setLoadingLookup] = useState(false)
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [motivoId, setMotivoId] = useState<MotivoId>('venta_retail')
  const [motivoOtro, setMotivoOtro] = useState('')

  const [retailId, setRetailId] = useState<RetailChoice>('Falabella')
  const [retailOtro, setRetailOtro] = useState('')

  const [funcionario, setFuncionario] = useState('')
  const [cantidad, setCantidad] = useState<number>(1)
  const [tipoAjuste, setTipoAjuste] = useState<'salida' | 'entrada'>('salida')
  const [dispositivo, setDispositivo] = useState(() =>
    (import.meta.env.VITE_SCANNER_DEVICE_ID ?? '').trim()
  )
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [genericModalOpen, setGenericModalOpen] = useState(false)
  const [genericProductSku, setGenericProductSku] = useState('')

  const [scanSuccessFlash, setScanSuccessFlash] = useState(false)
  const scanFlashTimerRef = useRef<number | null>(null)

  const abortLookupRef = useRef<AbortController | null>(null)
  const abortSubmitRef = useRef<AbortController | null>(null)

  const playSuccessBeep = () => {
    try {
      const AudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as
        | typeof AudioContext
        | undefined
      if (!AudioCtx) return

      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.value = 0.035
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      window.setTimeout(() => {
        osc.stop()
        ctx.close().catch(() => {})
      }, 90)
    } catch {
      // Silenciar fallos de audio (permiso/dispositivo).
    }
  }

  const triggerScanSuccess = () => {
    setScanSuccessFlash(true)
    playSuccessBeep()
    if (scanFlashTimerRef.current) window.clearTimeout(scanFlashTimerRef.current)
    scanFlashTimerRef.current = window.setTimeout(() => setScanSuccessFlash(false), 420)
  }

  /** Reinicia motivo/cantidad/tipo (no limpia mensajes ni funcionario). */
  const resetCamposAjuste = useCallback(() => {
    setMotivoId('venta_retail')
    setMotivoOtro('')
    setRetailId('Falabella')
    setRetailOtro('')
    setCantidad(1)
    setTipoAjuste('salida')
  }, [])

  const resolveMotivoApi = (): string => {
    if (motivoId === 'otro') return motivoOtro.trim()
    const found = MOTIVO_OPTIONS.find((m) => m.id === motivoId)
    return found?.label ?? ''
  }

  const resolveRetailApi = (): string | null => {
    if (motivoId !== 'venta_retail') return null
    if (retailId === 'Otro') return retailOtro.trim() || null
    return retailId
  }

  const handleBarcode = useCallback(
    async (code: string) => {
      const parsedDm = parseGs1LikeDataMatrix(code)
      if (parsedDm) {
        const unit = (unitItems || []).find(
          (u) =>
            String(u.id_unidad ?? '').trim() === parsedDm.id_unidad &&
            String(u.estado ?? u.status ?? '').toLowerCase().includes('disponible')
        )
        if (!unit) {
          setError('DataMatrix unitario no disponible o no encontrado.')
          return
        }
        const productLocal = products.find(
          (p) => String(p.codigoInventario ?? p.sku ?? '').trim() === parsedDm.sku
        )
        if (!productLocal) {
          setError(`No existe producto local para SKU ${parsedDm.sku}.`)
          return
        }
        setSelectedUnitId(String(unit.id_unidad ?? unit.id))
        setSuccess(`Unidad detectada correctamente: ${parsedDm.serial}`)
        setError(null)

        // Feedback inmediato (útil en escaneo mobile).
        triggerScanSuccess()

        setProducto({
          sku: String(productLocal.codigoInventario ?? productLocal.sku ?? ''),
          nombre: productLocal.name,
          stockActual: Number(productLocal.quantity) || 0,
          barcode: String(productLocal.barcode ?? ''),
          imagenUrl: '',
        } as ProductoEscaneado)
        return
      }

      if (/^\d{8,}$/.test(String(code).trim())) {
        const p = products.find((it) => {
          const sku = String(it.codigoInventario ?? it.sku ?? '').trim()
          const barcode = String(it.barcode ?? '').trim()
          return sku === code.trim() || barcode === code.trim()
        })
        if (p) {
          const sku = String(p.codigoInventario ?? p.sku ?? '').trim()
          const available = getAvailableUnitsBySku(sku)
          if (available.length > 0) {
            setGenericProductSku(sku)
            setGenericModalOpen(true)
            setProducto({
              sku,
              nombre: p.name,
              stockActual: Number(p.quantity) || 0,
              barcode: String(p.barcode ?? ''),
              imagenUrl: '',
            } as ProductoEscaneado)
            setSuccess(`Producto detectado: ${p.name}. Seleccione una unidad serializada.`)
            setError(null)
            return
          }
        }
      }

      abortLookupRef.current?.abort()
      const ac = new AbortController()
      abortLookupRef.current = ac

      setError(null)
      setSuccess(null)
      setProducto(null)
      setSelectedUnitId(null)
      resetCamposAjuste()
      setLoadingLookup(true)

      console.log('[AjustePorEscaneo] escaneo recibido:', code)

      try {
        const data = await fetchProductByBarcode(code, ac.signal)
        setProducto({ ...data, barcode: code })
        console.log('[AjustePorEscaneo] producto resuelto por API:', data)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        const msg = e instanceof Error ? e.message : 'Error de red al consultar el código.'
        setError(msg)
        console.error('[AjustePorEscaneo] error lookup:', e)
      } finally {
        setLoadingLookup(false)
      }
    },
    [resetCamposAjuste, unitItems, products, getAvailableUnitsBySku]
  )

  const { inputRef, onKeyDown, focusInput } = useBarcodeListener({ onBarcode: handleBarcode })

  useEffect(() => {
    focusInput()
  }, [focusInput])

  const validar = (): string | null => {
    const motivo = resolveMotivoApi()
    if (!motivo) return 'Indique el motivo del ajuste.'
    if (motivoId === 'venta_retail') {
      const r = resolveRetailApi()
      if (!r) return 'Seleccione o indique el retail para venta retail.'
    }
    if (!funcionario.trim()) return 'El nombre del funcionario es obligatorio.'
    const q = Math.abs(Number(cantidad)) || 0
    if (q < 1) return 'La cantidad debe ser al menos 1.'
    return null
  }

  const findLocalProductId = (sku: string, barcode: string) => {
    const s = sku.trim().toLowerCase()
    const b = barcode.trim().toLowerCase()
    const p = products.find((it) => {
      const c = String(it.codigoInventario ?? '').trim().toLowerCase()
      const sk = String(it.sku ?? '').trim().toLowerCase()
      const bc = String(it.barcode ?? '').trim().toLowerCase()
      return c === s || sk === s || bc === b || bc === s
    })
    return p?.id ?? null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!producto) {
      setError('Escanee un código de barras válido antes de registrar.')
      return
    }

    const v = validar()
    if (v) {
      setError(v)
      return
    }

    abortSubmitRef.current?.abort()
    const ac = new AbortController()
    abortSubmitRef.current = ac

    const qty = Math.abs(Number(cantidad)) || 1
    const motivo = resolveMotivoApi()
    const retail = resolveRetailApi()

    const payload: AjustePorEscaneoPayload = {
      sku: producto.sku,
      barcode: producto.barcode,
      motivo,
      retail,
      cantidad: qty,
      tipo: tipoAjuste,
      funcionario: funcionario.trim(),
      dispositivo: dispositivo.trim() || 'no-disponible',
      fecha: new Date().toISOString(),
    }

    setLoadingSubmit(true)
    console.log('[AjustePorEscaneo] enviando ajuste:', payload)

    try {
      await postAjustePorEscaneo(payload, ac.signal)

      console.log('[AjustePorEscaneo] ajuste registrado OK en backend')

      const pid = findLocalProductId(producto.sku, producto.barcode)
      const delta = tipoAjuste === 'entrada' ? qty : -qty
      const reasonParts = [
        `[Pistola] Barcode ${producto.barcode}`,
        `Motivo: ${motivo}`,
        retail ? `Retail: ${retail}` : null,
        `Tipo: ${tipoAjuste}`,
        user?.email ? `Sesión: ${user.email}` : null,
      ].filter(Boolean)

      const responsibleStr = `Funcionario: ${funcionario.trim()} | Dispositivo: ${dispositivo.trim() || 'N/D'}`

      if (pid != null) {
        const prod = products.find((x) => x.id === pid)
        const currentQty = Number(prod?.quantity) || 0
        const afterQty = Math.max(0, currentQty + delta)
        const baseVersion = Number(prod?.version) || 1

        addMovement(pid, {
          type: 'ajuste_pistola',
          delta,
          responsible: responsibleStr,
          reason: reasonParts.join(' · '),
          date: payload.fecha,
          unitId: selectedUnitId,
        })

        logAuditEvent({
          usuario: responsibleStr,
          accion: 'Ajuste por escaneo (pistola)',
          actionType: 'STOCK_ADJUST',
          targetSku: producto.sku,
          previousValue: currentQty,
          newValue: afterQty,
          detalle: `Ajuste vía pistola. ${reasonParts.join(' · ')}`,
          productoId: pid,
          sku: producto.sku,
          estadoAnterior: { quantity: currentQty, version: baseVersion },
          estadoNuevo: { quantity: afterQty, version: baseVersion + 1 },
          reversible: true,
        })
        if (selectedUnitId) {
          const nextStatus =
            tipoAjuste === 'salida'
              ? 'Vendida'
              : 'Seleccionada'
          updateUnitStatus(selectedUnitId, nextStatus)
        }
      }

      setSuccess('Ajuste registrado correctamente.')
      setProducto(null)
      setSelectedUnitId(null)
      resetCamposAjuste()
      setFuncionario('')
      focusInput()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Error de red al registrar el ajuste.'
      setError(msg)
      console.error('[AjustePorEscaneo] error al registrar:', err)
    } finally {
      setLoadingSubmit(false)
    }
  }

  const genericUnits = genericProductSku ? getAvailableUnitsBySku(genericProductSku) : []

  return (
    <div className="trazabilidad__form-block product-list__filter-card mt-10">
      {scanSuccessFlash && <div className="scan-success-flash" aria-hidden="true" />}
      <h3 className="trazabilidad__form-title">
        Ajuste por escaneo (pistola lectora)
      </h3>
      <p className="trazabilidad__help">
        Enfoque el cursor en el campo de escaneo. La pistola enviará el código y normalmente termina con{' '}
        <strong>Enter</strong> o <strong>Tab</strong>. Requiere backend en{' '}
        <code className="text-indigo-200">GET /api/barcodes/&#123;barcode&#125;</code> y{' '}
        <code className="text-indigo-200">POST /api/trazabilidad/ajuste</code>. En desarrollo puede usarse el proxy{' '}
        <code className="text-indigo-200">/api</code> de Vite; en producción defina{' '}
        <code className="text-indigo-200">VITE_API_BASE_URL</code>.
      </p>

      <div className="mb-6">
        <label className="product-list__filter-label" htmlFor="ajuste-scan-input">
          Campo de escaneo
        </label>
        <input
          id="ajuste-scan-input"
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          onKeyDown={onKeyDown}
          placeholder="Apunte aquí con la pistola…"
          className={inputClass}
          disabled={loadingLookup}
          aria-label="Campo de escaneo de código de barras"
        />
        {loadingLookup && (
          <p className="mt-2 text-sm text-amber-200" role="status">
            Consultando código…
          </p>
        )}
      </div>

      {(error || success) && (
        <div className="mb-4 space-y-2">
          {error && (
            <div
              className="rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-sm text-red-100"
              role="alert"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="rounded-md border border-emerald-500/60 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100"
              role="status"
            >
              {success}
            </div>
          )}
        </div>
      )}

      {producto && (
        <form className="space-y-5 max-w-2xl" onSubmit={handleSubmit}>
          <div className="rounded-lg border border-slate-600 bg-slate-900/40 p-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h4 className="text-sm font-semibold text-slate-100 mb-2">Producto (solo lectura)</h4>
            </div>
            <div>
              <span className="text-xs text-slate-400">SKU</span>
              <p className="text-slate-100 font-medium">{producto.sku}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Nombre</span>
              <p className="text-slate-100 font-medium">{producto.nombre}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Stock actual (servidor)</span>
              <p className="text-slate-100 font-medium">{producto.stockActual}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Código escaneado</span>
              <p className="text-slate-100 font-mono text-sm">{producto.barcode}</p>
            </div>
            <div className="sm:col-span-2 flex items-start gap-4">
              <div className="shrink-0 w-24 h-24 rounded border border-slate-600 overflow-hidden bg-slate-800 flex items-center justify-center">
                {producto.imagenUrl ? (
                  <img src={producto.imagenUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-500 px-2 text-center">Sin imagen</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-base font-medium text-slate-200 mb-2">Motivo del ajuste</label>
            <select
              value={motivoId}
              onChange={(e) => setMotivoId(e.target.value as MotivoId)}
              className={inputClass}
            >
              {MOTIVO_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {motivoId === 'otro' && (
            <div>
              <label className="block text-base font-medium text-slate-200 mb-2">Especifique el motivo</label>
              <input
                type="text"
                value={motivoOtro}
                onChange={(e) => setMotivoOtro(e.target.value)}
                className={inputClass}
                placeholder="Describa el motivo"
                required
              />
            </div>
          )}

          {motivoId === 'venta_retail' && (
            <div className="space-y-3">
              <label className="block text-base font-medium text-slate-200 mb-2">Retail</label>
              <select
                value={retailId}
                onChange={(e) => setRetailId(e.target.value as RetailChoice)}
                className={inputClass}
              >
                {RETAIL_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {retailId === 'Otro' && (
                <input
                  type="text"
                  value={retailOtro}
                  onChange={(e) => setRetailOtro(e.target.value)}
                  className={inputClass}
                  placeholder="Nombre del retail"
                  required
                />
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-base font-medium text-slate-200 mb-2">Nombre del funcionario</label>
              <input
                type="text"
                value={funcionario}
                onChange={(e) => setFuncionario(e.target.value)}
                className={inputClass}
                placeholder="Nombre completo"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium text-slate-200 mb-2">Cantidad</label>
              <input
                type="number"
                min={1}
                step={1}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <span className="block text-base font-medium text-slate-200 mb-2">Tipo de ajuste</span>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-slate-100">
                <input
                  type="radio"
                  name="tipoAjuste"
                  checked={tipoAjuste === 'salida'}
                  onChange={() => setTipoAjuste('salida')}
                />
                Salida
              </label>
              <label className="inline-flex items-center gap-2 text-slate-100">
                <input
                  type="radio"
                  name="tipoAjuste"
                  checked={tipoAjuste === 'entrada'}
                  onChange={() => setTipoAjuste('entrada')}
                />
                Entrada
              </label>
            </div>
          </div>

          <div>
            <label className="block text-base font-medium text-slate-200 mb-2">
              ID dispositivo (pistola)
            </label>
            <input
              type="text"
              value={dispositivo}
              onChange={(e) => setDispositivo(e.target.value)}
              className={inputClass}
              placeholder="Opcional — también VITE_SCANNER_DEVICE_ID"
            />
          </div>

          <button
            type="submit"
            disabled={loadingSubmit}
            className="trazabilidad__btn w-full sm:w-auto font-semibold rounded-lg px-5 py-2.5 transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
          >
            {loadingSubmit ? 'Registrando…' : 'Registrar ajuste'}
          </button>
        </form>
      )}

      {genericModalOpen && (
        <div className="import__modal-overlay" role="dialog" aria-modal="true" aria-label="Seleccionar serial">
          <div className="import__modal import__modal--purge">
            <h3>Producto detectado: {producto?.nombre}</h3>
            <p>Has escaneado un código genérico. Selecciona manualmente un serial disponible:</p>
            {genericUnits.length === 0 ? (
              <p>No hay seriales disponibles para este SKU.</p>
            ) : (
              <div className="product-table-wrapper">
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>ID Unidad</th>
                      <th>Serial</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {genericUnits.slice(0, 50).map((u) => (
                      <tr key={u.id_unidad ?? u.id}>
                        <td>{u.id_unidad}</td>
                        <td>{u.serial}</td>
                        <td>
                          <button
                            type="button"
                            className="product-list__ficha-btn"
                            onClick={() => {
                              setSelectedUnitId(String(u.id_unidad ?? u.id))
                              setGenericModalOpen(false)
                              setSuccess(`Unidad seleccionada manualmente: ${u.serial}`)
                            }}
                            style={{
                              width: '100%',
                              padding: '0.75rem 0.85rem',
                              fontSize: '1rem',
                              fontWeight: 700,
                              borderRadius: 10,
                              textAlign: 'center',
                              minHeight: 48,
                            }}
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="import__modal-actions">
              <button
                type="button"
                className="import__btn import__btn--secondary"
                onClick={() => setGenericModalOpen(false)}
                style={{ padding: '0.85rem 1rem', fontSize: '1rem', fontWeight: 700, minHeight: 48 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
