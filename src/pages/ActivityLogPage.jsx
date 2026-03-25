import { useState } from 'react'
import {
  Image,
  ArrowUpDown,
  RotateCcw,
  Trash2,
  Package,
  AlertTriangle,
  FileInput,
  ClipboardCheck,
  Ban,
  History,
} from 'lucide-react'
import { useInventory } from '../context/InventoryContext'

const formatDate = (iso) => {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

/** Evita "Usuario: Usuario Autenticado: correo" y deja un solo texto legible. */
const formatAuditUsuarioLine = (raw) => {
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim()
  const m = s.match(/^Usuario\s+Autenticado:\s*(.+)$/i)
  if (m) return { label: 'Responsable', value: m[1].trim() }
  return { label: 'Usuario', value: s }
}

const ActivityLogPage = () => {
  const { auditEvents, revertAuditEvent } = useInventory()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const events = [...auditEvents].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  )

  const handleUndo = (evt) => {
    setMessage('')
    setError('')
    const result = revertAuditEvent(evt.id)
    if (result?.ok) {
      setMessage(`Acción revertida con éxito para el SKU ${evt.targetSku ?? evt.sku ?? 'N/D'}.`)
    } else {
      setError(result?.reason || 'No se pudo revertir la acción.')
    }
  }

  const getIconForEvent = (evt) => {
    if (evt.actionType === 'IMAGE_UPDATE') {
      return <Image className="w-4 h-4 text-sky-300" />
    }
    if (evt.actionType === 'STOCK_ADJUST') {
      return <ArrowUpDown className="w-4 h-4 text-emerald-300" />
    }
    if (evt.actionType === 'IMAGE_CLEAR_ALL') {
      return <Trash2 className="w-4 h-4 text-red-300" />
    }
    if (evt.actionType === 'IMPORT_COMMIT') {
      return <FileInput className="w-4 h-4 text-violet-300" />
    }
    if (evt.actionType === 'IMPORT_REJECTED') {
      return <Ban className="w-4 h-4 text-amber-300" />
    }
    if (evt.actionType === 'VERIFICATION_STATUS_UPDATE') {
      return <ClipboardCheck className="w-4 h-4 text-cyan-300" />
    }
    if (evt.actionType === 'MOVEMENT_LEDGER_RESET') {
      return <History className="w-4 h-4 text-rose-300" />
    }
    if (evt.actionType === 'INVENTORY_PURGE') {
      return <AlertTriangle className="w-4 h-4 text-orange-300" />
    }
    if (evt.actionType === 'BARCODE_IMPORT') {
      return <Package className="w-4 h-4 text-slate-400" />
    }
    return <ArrowUpDown className="w-4 h-4 text-slate-300" />
  }

  const summarizeValue = (value) => {
    if (Array.isArray(value)) {
      return `${value.length} elemento(s)`
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value)
      return `Objeto { ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''} }`
    }
    if (value === null || value === undefined) return '—'
    return String(value)
  }

  return (
    <div className="page activity-log-page">
      <section className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-slate-100 mb-2">
          Historial de Actividad
        </h2>
        <p className="text-sm text-slate-300 mb-4">
          Línea de tiempo de cambios importantes: importaciones CSV, rechazos de carga, vaciados, cambios de estado de
          verificación, movimientos de stock, imágenes y más.
        </p>

        {(message || error) && (
          <div className="mb-4 space-y-2">
            {message && (
              <div className="rounded-md border border-emerald-500/60 bg-emerald-900/40 px-3 py-2 text-xs text-emerald-100">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-xs text-red-100">
                {error}
              </div>
            )}
          </div>
        )}

        {events.length === 0 ? (
          <p className="text-slate-400 text-sm">
            Aún no hay eventos registrados. Las importaciones CSV, los rechazos antes de confirmar una carga, los cambios
            de estado de verificación en Bienes, los movimientos de stock, las actualizaciones de imágenes y otras acciones
            auditadas aparecerán aquí.
          </p>
        ) : (
          <ol className="relative border-l border-slate-600 pl-4 space-y-6">
            {events.map((evt) => {
              const usuarioLine = evt.usuario ? formatAuditUsuarioLine(evt.usuario) : null
              return (
              <li key={evt.id} className="ml-2">
                <div className="absolute -left-2 top-2 w-3 h-3 rounded-full bg-indigo-400 border border-slate-900" />
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        {getIconForEvent(evt)}
                        <span className="break-words">{evt.accion}</span>
                      </div>
                      {evt.undone && (
                        <span
                          className="inline-flex w-fit max-w-full items-center rounded border border-amber-500/40 bg-amber-950/35 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200"
                          aria-label="Evento revertido"
                        >
                          Revertido
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-xs text-slate-400 tabular-nums">
                      {formatDate(evt.timestamp)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 mb-2 space-y-1.5">
                    {usuarioLine && (
                      <div className="break-words">
                        <span className="font-semibold">{usuarioLine.label}:</span>{' '}
                        <span>{usuarioLine.value}</span>
                      </div>
                    )}
                    {evt.sku && (
                      <div className="break-all sm:break-words">
                        <span className="font-semibold">SKU:</span>{' '}
                        <span>{evt.sku}</span>
                      </div>
                    )}
                  </div>
                  {evt.detalle && (
                    <p className="text-sm leading-relaxed text-slate-100 mb-3">{evt.detalle}</p>
                  )}
                  {evt.correlationId && (
                    <p className="text-xs text-slate-400 mb-2">
                      <span className="font-semibold text-slate-300">ID correlación:</span> {evt.correlationId}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-600/40 pt-3 text-xs">
                    <div className="flex flex-col gap-1">
                      {evt.actionType !== 'IMPORT_COMMIT' &&
                        evt.actionType !== 'IMPORT_REJECTED' &&
                        evt.actionType !== 'MOVEMENT_LEDGER_RESET' &&
                        evt.actionType !== 'INVENTORY_PURGE' &&
                        evt.actionType !== 'BARCODE_IMPORT' &&
                        evt.actionType !== 'VERIFICATION_STATUS_UPDATE' && (
                        <>
                          <div>
                            <span className="font-semibold text-slate-200">
                              Valor anterior:
                            </span>{' '}
                            <span className="text-slate-100">
                              {summarizeValue(evt.previousValue ?? evt.estadoAnterior)}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-200">
                              Valor nuevo:
                            </span>{' '}
                            <span className="text-slate-100">
                              {summarizeValue(evt.newValue ?? evt.estadoNuevo)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {evt.reversible !== false && !evt.undone && (
                        <button
                          type="button"
                          onClick={() => handleUndo(evt)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-500/70 bg-slate-900/60 px-2 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Revertir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}

export default ActivityLogPage

