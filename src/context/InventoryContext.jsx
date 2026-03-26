import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { products as initialProducts } from '../data/products'
import { loadPersistedInventory, savePersistedInventory } from '../services/inventoryPersistence'
import { resolveBarcode } from '../utils/resolveBarcode'
import {
  DEFAULT_UBICACION_FISICA,
  UBICACION_FISICA_OPTIONS,
  ESTADO_VERIFICACION,
  resolveUbicacionFisicaFromCsv,
} from '../types/product'
import {
  MOVEMENT_SOURCE_CSV_IMPORT,
  MOVEMENT_SOURCE_MANUAL_TRAZABILIDAD,
  MOVEMENT_SOURCE_MANUAL_SCAN_UI,
  MOVEMENT_TYPE_CSV_IMPORT,
  MOVEMENT_TYPE_ADJUST_QUANTITY,
} from '../types/movement'
import {
  barcodesMatchForManualAdjust,
  isBarcodeEligibleForManualAdjust,
} from '../utils/barcodeManualAdjust'
import { createUniqueSerial, createSerializedUnit } from '../utils/datamatrixUnit'

const labelEstadoVerificacion = (code) => ESTADO_VERIFICACION[code] ?? String(code ?? '—')

const InventoryContext = createContext(null)

export const useInventory = () => {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider')
  }
  return context
}

const nextId = (items) => {
  if (items.length === 0) return 1
  return Math.max(...items.map((p) => p.id), 0) + 1
}

const nextMovementId = (movements) => {
  if (!movements?.length) return 1
  return Math.max(...movements.map((m) => m.id), 0) + 1
}

const createEventId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const normalizeUbicacionFisica = (value) => {
  const v = String(value ?? '').trim()
  if (UBICACION_FISICA_OPTIONS.some((o) => o.value === v)) return v
  return DEFAULT_UBICACION_FISICA
}

const UNIT_STORAGE_KEY = 'inventory_units'

const readUnitsFromLocalStorage = () => {
  try {
    const raw = window.localStorage.getItem(UNIT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const writeUnitsToLocalStorage = (items) => {
  try {
    window.localStorage.setItem(UNIT_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota/private mode errors
  }
}

/**
 * Normaliza unidades serializadas existentes a la estructura actual:
 * { id_unidad, sku_maestro, serial, gs1LikeCode, estado, fecha_ingreso, etiqueta_impresa }
 */
const normalizeUnitItems = (items) => {
  if (!Array.isArray(items)) return []
  return items
    .map((u) => {
      if (!u || typeof u !== 'object') return null

      const hasNewFields = u.id_unidad && u.sku_maestro && u.serial && (u.gs1LikeCode || u.gs1LikeCode === '')

      if (hasNewFields) {
        return {
          ...u,
          etiqueta_impresa: u.etiqueta_impresa === true,
          // compatibilidad: asegurar fecha_ingreso.
          fecha_ingreso: u.fecha_ingreso ?? u.ingresoAt ?? u.timestamp ?? new Date().toISOString(),
        }
      }

      const sku = String(u.sku_maestro ?? u.sku ?? u.master_sku ?? '').trim()
      const serial =
        String(u.serial ?? u.id ?? '').trim() ||
        (typeof u.id_unidad === 'string'
          ? u.id_unidad.match(/\(21\)([^()]+)$/)?.[1]?.trim()
          : '')

      if (!sku || !serial) return null

      const status = String(u.estado ?? u.status ?? 'Disponible - Inventario Inicial').trim()
      const ingresoRaw = u.fecha_ingreso ?? u.ingresoAt ?? u.timestamp ?? new Date().toISOString()
      const ingresoIso = new Date(ingresoRaw).toISOString()

      return createSerializedUnit({
        sku,
        serial,
        status,
        ingresoAt: ingresoIso,
        etiquetaImpresa: u.etiqueta_impresa === true,
        productName: String(u.productName ?? ''),
        productId: u.productId ?? null,
      })
    })
    .filter(Boolean)
}

export const InventoryProvider = ({ children }) => {
  const [products, setProducts] = useState(initialProducts)
  const [movements, setMovements] = useState([])
  const [auditEvents, setAuditEvents] = useState([])
  const [unitItems, setUnitItems] = useState([])
  const [persistenceHydrated, setPersistenceHydrated] = useState(false)
  const saveTimerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadPersistedInventory().then((data) => {
      if (cancelled || !data) {
        setPersistenceHydrated(true)
        return
      }
      if (Array.isArray(data.products)) setProducts(data.products)
      if (Array.isArray(data.movements)) setMovements(data.movements)
      if (Array.isArray(data.auditEvents)) setAuditEvents(data.auditEvents)
      if (Array.isArray(data.unitItems)) setUnitItems(normalizeUnitItems(data.unitItems))
      const unitsLs = readUnitsFromLocalStorage()
      if (Array.isArray(unitsLs)) setUnitItems(normalizeUnitItems(unitsLs))
      setPersistenceHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!persistenceHydrated) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      savePersistedInventory({ products, movements, auditEvents, unitItems })
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [products, movements, auditEvents, unitItems, persistenceHydrated])

  useEffect(() => {
    if (!persistenceHydrated) return
    writeUnitsToLocalStorage(unitItems)
  }, [unitItems, persistenceHydrated])

  const logAuditEvent = useCallback((partialEvent) => {
    setAuditEvents((prev) => [
      ...prev,
      {
        id: createEventId(),
        timestamp: new Date().toISOString(),
        ...partialEvent,
      },
    ])
  }, [])

  const revertAuditEvent = useCallback(
    (eventId) => {
      const evt = auditEvents.find((e) => e.id === eventId)
      if (!evt || evt.undone || evt.reversible === false || !evt.productoId || !evt.estadoAnterior) {
        return { ok: false, reason: 'Evento no reversible o no encontrado.' }
      }

      let applied = false
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === evt.productoId)
        if (idx === -1) return prev
        const product = prev[idx]

        const expectedVersion = evt.estadoNuevo?.version
        if (typeof expectedVersion === 'number' && product.version !== expectedVersion) {
          return prev
        }

        let updated = { ...product }

        if (evt.actionType === 'STOCK_ADJUST' && evt.estadoAnterior && 'quantity' in evt.estadoAnterior) {
          updated.quantity = Math.max(0, Number(evt.estadoAnterior.quantity) || 0)
        }

        if (
          evt.actionType === 'IMAGE_UPDATE' &&
          Array.isArray(evt.estadoAnterior.imagenesReferenciales)
        ) {
          updated.imagenesReferenciales = [...evt.estadoAnterior.imagenesReferenciales]
        }

        updated.version = (updated.version ?? 1) + 1
        const clone = [...prev]
        clone[idx] = updated
        applied = true
        return clone
      })

      if (!applied) {
        return { ok: false, reason: 'La versión del producto cambió; no se puede revertir de forma segura.' }
      }

      setAuditEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, undone: true } : e))
      )

      return { ok: true }
    },
    [auditEvents]
  )

  /**
   * Añade o reemplaza bienes desde importación CSV.
   * - Modo inicial (`overwrite`): reemplaza todo el inventario por las filas (deduplicadas en UI).
   * - Modo actualización: merge por SKU — actualiza el bien existente o crea uno nuevo.
   *
   * @param {Array<Object>} rows - Filas parseadas (idealmente `appliedRows` de `computeImportPlan`)
   * @param {{ overwrite?: boolean, actorEmail?: string, fileName?: string | null, correlationId?: string, logBarcodeRowAudit?: boolean }} options
   */
  const addBienesFromImport = useCallback(
    (rows, options = {}) => {
      const overwrite = !!options.overwrite
      const actor = String(options.actorEmail ?? '').trim() || 'Sistema'
      const fileName = options.fileName != null ? String(options.fileName) : null
      const correlationId =
        options.correlationId ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `imp-${Date.now()}`)
      const logBarcodeRowAudit = !!options.logBarcodeRowAudit

      let auditToLog = []
      let summary = {
        newCount: 0,
        updatedCount: 0,
        baseCount: 0,
        overwrite,
        appliedRowCount: rows.length,
      }

      /** Movimientos kardex del merge (se rellenan dentro del updater de `setProducts`). */
      let importMovementsDraft = []

      const pushBarcodeAudit = (sku, resolved) => {
        if (!logBarcodeRowAudit) return
        auditToLog.push({
          usuario: actor,
          accion: 'Resolución de barcode (importación CSV)',
          actionType: 'BARCODE_IMPORT',
          targetSku: sku,
          sku,
          correlationId,
          detalle:
            resolved.source === 'csv'
              ? `Barcode usado desde CSV para SKU ${sku}: ${resolved.barcode}`
              : resolved.source === 'auto'
                ? `Barcode generado automáticamente (fallback BC-{SKU}) para SKU ${sku}: ${resolved.barcode}`
                : resolved.source === 'invalid_format_fallback'
                  ? `Barcode inválido en CSV para SKU ${sku}; se usó fallback: ${resolved.barcode}${
                      resolved.validationError ? ` (${resolved.validationError})` : ''
                    }`
                  : `Barcode duplicado resuelto por sufijo incremental para SKU ${sku}: ${resolved.barcode}`,
          reversible: false,
        })
      }

      if (overwrite) {
        let clearedCount = 0
        setMovements((prev) => {
          clearedCount = prev.length
          return []
        })
        logAuditEvent({
          usuario: actor,
          accion: 'Reinicio de trazabilidad operativa (kardex)',
          actionType: 'MOVEMENT_LEDGER_RESET',
          correlationId,
          reversible: false,
          detalle: `Inventario inicial por CSV: se eliminaron ${clearedCount} movimiento(s) previos del registro operativo para evitar referencias obsoletas tras la sobrescritura.${fileName ? ` Archivo: ${fileName}.` : ''}`,
          metadata: {
            movementsCleared: clearedCount,
            fileName,
            overwrite: true,
            correlationId,
          },
        })
      }

      setProducts((prevProducts) => {
        importMovementsDraft = []
        if (overwrite) {
          const usedBarcodes = new Set()
          let id = 1
          auditToLog = []
          const newItems = rows.map((row) => {
            const sku = String(row.codigoInventario ?? row.sku ?? '').trim()
            const resolved = resolveBarcode(sku, row.barcode, usedBarcodes)
            if (resolved.barcode) usedBarcodes.add(resolved.barcode)
            pushBarcodeAudit(sku, resolved)

            return {
              id: id++,
              name: row.name ?? '',
              sku,
              codigoInventario: sku,
              barcode: resolved.barcode,
              ubicacionFisica: resolveUbicacionFisicaFromCsv(row.ubicacionFisica),
              detalleUbicacion: String(row.detalleUbicacion ?? '').trim(),
              tipoBien: row.tipoBien === 'inmueble' ? 'inmueble' : 'mueble',
              description: row.description ?? '',
              quantity: Math.max(0, Number(row.quantity) || 0),
              price: Math.max(0, Number(row.price) || 0),
              cost: 0,
              valorLibros: Math.max(0, Number(row.valorLibros) || 0),
              estadoVerificacion: ['teorico', 'verificado_terreno', 'no_encontrado'].includes(row.estadoVerificacion)
                ? row.estadoVerificacion
                : 'teorico',
              especificaciones: row.especificaciones ?? '',
              caracteristicas: row.caracteristicas ?? '',
              composicion: row.composicion ?? '',
              material: row.material ?? '',
              formato: row.formato ?? '',
              origen: row.origen ?? '',
              tamano: row.tamano ?? '',
              certificaciones: row.certificaciones ?? '',
              imagenesReferenciales: Array.isArray(row.imagenesReferenciales) ? row.imagenesReferenciales : [],
              version: 1,
            }
          })

          summary = {
            newCount: newItems.length,
            updatedCount: 0,
            baseCount: prevProducts.length,
            overwrite: true,
            appliedRowCount: rows.length,
          }
          return newItems
        }

        const usedBarcodes = new Set(
          prevProducts.map((p) => String(p.barcode ?? '').trim()).filter(Boolean)
        )
        let next = [...prevProducts]
        let id = nextId(next)
        auditToLog = []
        let created = 0
        let updated = 0

        for (const row of rows) {
          const sku = String(row.codigoInventario ?? row.sku ?? '').trim()
          const idx = next.findIndex((p) => String(p.codigoInventario ?? p.sku ?? '').trim() === sku)

          if (idx === -1) {
            const resolved = resolveBarcode(sku, row.barcode, usedBarcodes)
            if (resolved.barcode) usedBarcodes.add(resolved.barcode)
            pushBarcodeAudit(sku, resolved)

            const newId = id++
            const afterQty = Math.max(0, Number(row.quantity) || 0)
            next.push({
              id: newId,
              name: row.name ?? '',
              sku,
              codigoInventario: sku,
              barcode: resolved.barcode,
              ubicacionFisica: resolveUbicacionFisicaFromCsv(row.ubicacionFisica),
              detalleUbicacion: String(row.detalleUbicacion ?? '').trim(),
              tipoBien: row.tipoBien === 'inmueble' ? 'inmueble' : 'mueble',
              description: row.description ?? '',
              quantity: afterQty,
              price: Math.max(0, Number(row.price) || 0),
              cost: 0,
              valorLibros: Math.max(0, Number(row.valorLibros) || 0),
              estadoVerificacion: ['teorico', 'verificado_terreno', 'no_encontrado'].includes(row.estadoVerificacion)
                ? row.estadoVerificacion
                : 'teorico',
              especificaciones: row.especificaciones ?? '',
              caracteristicas: row.caracteristicas ?? '',
              composicion: row.composicion ?? '',
              material: row.material ?? '',
              formato: row.formato ?? '',
              origen: row.origen ?? '',
              tamano: row.tamano ?? '',
              certificaciones: row.certificaciones ?? '',
              imagenesReferenciales: Array.isArray(row.imagenesReferenciales) ? row.imagenesReferenciales : [],
              version: 1,
            })
            created += 1
            if (afterQty !== 0) {
              importMovementsDraft.push({
                productId: newId,
                productName: row.name ?? '',
                codigoInventario: sku,
                type: MOVEMENT_TYPE_CSV_IMPORT,
                quantityDelta: afterQty,
                quantityBefore: 0,
                quantityAfter: afterQty,
                responsible: actor,
                reason: `Importación CSV (actualización)${fileName ? ` · ${fileName}` : ''}`,
                retail: null,
                date: new Date().toISOString(),
                correlationId,
                source: MOVEMENT_SOURCE_CSV_IMPORT,
              })
            }
          } else {
            const p = next[idx]
            const forResolve = new Set(usedBarcodes)
            const currentBc = String(p.barcode ?? '').trim()
            if (currentBc) forResolve.delete(currentBc)
            const resolved = resolveBarcode(sku, row.barcode, forResolve)
            if (currentBc && resolved.barcode !== currentBc) usedBarcodes.delete(currentBc)
            if (resolved.barcode) usedBarcodes.add(resolved.barcode)
            pushBarcodeAudit(sku, resolved)

            const providedEstado = !!row.estadoVerificacionProvided
            const nextEstado =
              providedEstado && ['teorico', 'verificado_terreno', 'no_encontrado'].includes(row.estadoVerificacion)
                ? row.estadoVerificacion
                : p.estadoVerificacion

            const rowImages = Array.isArray(row.imagenesReferenciales) ? row.imagenesReferenciales : []

            const beforeQty = Math.max(0, Number(p.quantity) || 0)
            const afterQty = Math.max(0, Number(row.quantity) || 0)

            next[idx] = {
              ...p,
              name: row.name ?? p.name,
              sku,
              codigoInventario: sku,
              barcode: resolved.barcode,
              ubicacionFisica: resolveUbicacionFisicaFromCsv(row.ubicacionFisica),
              detalleUbicacion:
                row.detalleUbicacion != null && String(row.detalleUbicacion).trim() !== ''
                  ? String(row.detalleUbicacion).trim()
                  : p.detalleUbicacion,
              tipoBien: row.tipoBien === 'inmueble' ? 'inmueble' : 'mueble',
              description: row.description ?? p.description,
              quantity: afterQty,
              price: Math.max(0, Number(row.price) || 0),
              valorLibros: Math.max(0, Number(row.valorLibros) || 0),
              estadoVerificacion: nextEstado,
              especificaciones: row.especificaciones ?? p.especificaciones,
              caracteristicas: row.caracteristicas ?? p.caracteristicas,
              composicion: row.composicion ?? p.composicion,
              material: row.material ?? p.material,
              formato: row.formato ?? p.formato,
              origen: row.origen ?? p.origen,
              tamano: row.tamano ?? p.tamano,
              certificaciones: row.certificaciones ?? p.certificaciones,
              imagenesReferenciales: rowImages.length > 0 ? rowImages : p.imagenesReferenciales,
              version: (p.version ?? 1) + 1,
            }
            updated += 1
            if (beforeQty !== afterQty) {
              importMovementsDraft.push({
                productId: p.id,
                productName: next[idx].name,
                codigoInventario: sku,
                type: MOVEMENT_TYPE_CSV_IMPORT,
                quantityDelta: afterQty - beforeQty,
                quantityBefore: beforeQty,
                quantityAfter: afterQty,
                responsible: actor,
                reason: `Importación CSV (actualización)${fileName ? ` · ${fileName}` : ''}`,
                retail: null,
                date: new Date().toISOString(),
                correlationId,
                source: MOVEMENT_SOURCE_CSV_IMPORT,
              })
            }
          }
        }

        summary = {
          newCount: created,
          updatedCount: updated,
          baseCount: prevProducts.length,
          overwrite: false,
          appliedRowCount: rows.length,
        }
        return next
      })

      if (!overwrite && importMovementsDraft.length > 0) {
        setMovements((m) => {
          let nid = nextMovementId(m)
          const stamped = importMovementsDraft.map((draft) => ({ ...draft, id: nid++ }))
          return [...m, ...stamped]
        })
      }

      // Explosión unitaria para trazabilidad serializada desde CSV.
      // - overwrite: reemplaza unidades de las SKUs involucradas (y en modo overwrite se reconstruyen desde cero).
      // - actualización: ajusta cantidad final preservando unidades "impresas" cuando existe.
      if (rows.length > 0) {
        const skuRowMap = new Map()
        rows.forEach((row) => {
          const sku = String(row.codigoInventario ?? row.sku ?? '').trim()
          const qty = Math.max(0, Number(row.quantity) || 0)
          const productName = String(row.name ?? '').trim()
          if (!sku || qty <= 0) return
          const current = skuRowMap.get(sku)
          skuRowMap.set(sku, {
            sku,
            productName: productName || current?.productName || '',
            qty: (current?.qty ?? 0) + qty,
          })
        })

        if (skuRowMap.size > 0) {
          setUnitItems((prev) => {
            const skuSet = new Set(Array.from(skuRowMap.keys()))
            const existingSerialsAll = new Set(prev.map((u) => String(u.serial ?? '')).filter(Boolean))

            // overwrite: se reconstruye todo con las SKUs del CSV.
            if (overwrite) {
              const generated = []
              const serials = new Set(existingSerialsAll)
              Array.from(skuRowMap.values()).forEach(({ sku, qty, productName }) => {
                for (let i = 0; i < qty; i += 1) {
                  const serial = createUniqueSerial(serials)
                  serials.add(serial)
                  generated.push(
                    createSerializedUnit({
                      sku,
                      serial,
                      productName,
                      status: 'Disponible - Inventario Inicial',
                      etiquetaImpresa: false,
                    })
                  )
                }
              })
              return generated
            }

            // actualización: ajustar por SKU final deseado.
            const next = prev.filter((u) => !skuSet.has(String(u.sku_maestro ?? u.sku ?? '').trim()))

            const generatedMissing = []
            Array.from(skuRowMap.values()).forEach(({ sku, qty, productName }) => {
              const prevForSku = prev.filter(
                (u) => String(u.sku_maestro ?? u.sku ?? '').trim() === sku
              )
              const printed = prevForSku.filter((u) => u.etiqueta_impresa === true)
              const unprinted = prevForSku.filter((u) => u.etiqueta_impresa !== true)

              const desired = Math.max(0, qty)
              const printedKept = printed.slice(0, desired)
              const unprintedToKeepCount = Math.max(0, desired - printedKept.length)
              const unprintedKept = unprinted.slice(0, unprintedToKeepCount)

              const existingSerials = new Set(
                Array.from(
                  new Set(
                    next
                      .concat(printedKept)
                      .concat(unprintedKept)
                      .map((u) => String(u.serial ?? ''))
                      .filter(Boolean)
                  )
                )
              )

              const missing = desired - (printedKept.length + unprintedKept.length)
              for (let i = 0; i < missing; i += 1) {
                const serial = createUniqueSerial(existingSerials)
                existingSerials.add(serial)
                generatedMissing.push(
                  createSerializedUnit({
                    sku,
                    serial,
                    productName,
                    status: 'Disponible - Inventario Inicial',
                    etiquetaImpresa: false,
                  })
                )
              }
              next.push(...printedKept, ...unprintedKept)
            })

            return next.concat(generatedMissing)
          })
        }
      }

      const modeLabel = overwrite ? 'Inventario inicial (sobrescritura)' : 'Actualización masiva (merge por SKU)'
      const detailParts = overwrite
        ? [`${summary.newCount} bien(es) cargado(s)`]
        : [
            `${summary.newCount} alta(s)`,
            `${summary.updatedCount} actualización(es)`,
            `${summary.appliedRowCount} fila(s) única(s) por SKU aplicada(s)`,
          ]
      logAuditEvent({
        usuario: actor,
        accion: 'Importación CSV confirmada',
        actionType: 'IMPORT_COMMIT',
        correlationId,
        reversible: false,
        detalle: `${modeLabel}: ${detailParts.join('; ')}.${fileName ? ` Archivo: ${fileName}.` : ''}`,
        metadata: {
          rowCount: summary.appliedRowCount,
          createdCount: summary.newCount,
          updatedCount: summary.updatedCount,
          overwrite: summary.overwrite,
          fileName,
          previousProductCount: summary.baseCount,
        },
      })

      auditToLog.forEach((evt) => logAuditEvent(evt))
    },
    [logAuditEvent]
  )

  /**
   * Vacía productos y movimientos (solo administrador en UI).
   * Conserva el historial de auditoría y registra INVENTORY_PURGE.
   * @param {{ actorEmail?: string, snapshot?: { productCount: number, movementCount: number, auditEventCount: number, totalUnidades: number } }} options
   */
  const vaciarInventario = useCallback(
    (options = {}) => {
      const actor = String(options.actorEmail ?? '').trim() || 'Desconocido'
      const snap = options.snapshot ?? {
        productCount: 0,
        movementCount: 0,
        auditEventCount: 0,
        totalUnidades: 0,
      }
      logAuditEvent({
        usuario: actor,
        accion: 'Vaciado de inventario',
        actionType: 'INVENTORY_PURGE',
        reversible: false,
        detalle: `Inventario vaciado: ${snap.productCount} activos, ${snap.totalUnidades ?? 0} unidades en stock, ${snap.movementCount} movimientos eliminados de memoria. Eventos de auditoría previos: ${snap.auditEventCount}.`,
        metadata: { ...snap },
      })
      setProducts(initialProducts)
      setMovements([])
      setUnitItems([])
    },
    [logAuditEvent]
  )

  /** Añade un único bien (para Colaborador: ítem individual). */
  const addProduct = useCallback((product) => {
    if (!product?.name && !product?.codigoInventario) return
    setProducts((prev) => {
      const id = nextId(prev)
      const usedBarcodes = new Set(prev.map((p) => String(p.barcode ?? '').trim()).filter(Boolean))

      const skuResolved = product.codigoInventario ?? product.sku ?? `INV-${id}`
      const resolved = resolveBarcode(skuResolved, product.barcode, usedBarcodes)
      if (resolved.barcode) usedBarcodes.add(resolved.barcode)

      const newItem = {
        id,
        name: product.name ?? '',
        sku: skuResolved,
        codigoInventario: skuResolved,
        barcode: resolved.barcode,
        ubicacionFisica: normalizeUbicacionFisica(product.ubicacionFisica),
        detalleUbicacion: String(product.detalleUbicacion ?? '').trim(),
        tipoBien: product.tipoBien === 'inmueble' ? 'inmueble' : 'mueble',
        description: product.description ?? '',
        quantity: Math.max(0, Number(product.quantity) || 0),
        price: Number(product.price) || 0,
        cost: Number(product.cost) || 0,
        valorLibros: Math.max(0, Number(product.valorLibros) || 0),
        estadoVerificacion: ['teorico', 'verificado_terreno', 'no_encontrado'].includes(product.estadoVerificacion)
          ? product.estadoVerificacion
          : 'teorico',
        especificaciones: product.especificaciones ?? '',
        caracteristicas: product.caracteristicas ?? '',
        composicion: product.composicion ?? '',
        material: product.material ?? '',
        formato: product.formato ?? '',
        origen: product.origen ?? '',
        tamano: product.tamano ?? '',
        certificaciones: product.certificaciones ?? '',
        imagenesReferenciales: Array.isArray(product.imagenesReferenciales) ? product.imagenesReferenciales : [],
        version: 1,
      }
      return [...prev, newItem]
    })
  }, [])

  /**
   * Actualiza un bien existente (p. ej. estado de verificación, ubicación, cantidad).
   * Si cambia `quantity` y before ≠ after, añade movimiento kardex (`ajuste_cantidad`, source `manual_scan_ui`) con verificación por barcode.
   *
   * @param {number|string} productId
   * @param {Record<string, unknown>} partial
   * @param {{ actorEmail?: string, stockChangeReason?: string, stockChangeBarcode?: string }} [options] - Si cambia el stock: motivo + escaneo que coincida con `product.barcode` (normalizado).
   */
  const updateProduct = useCallback(
    (productId, partial, options = {}) => {
      if (!productId || !partial || typeof partial !== 'object') return
      const actor = String(options.actorEmail ?? '').trim() || 'Sistema'
      const stockReasonRaw = String(options.stockChangeReason ?? '').trim()
      const stockChangeBarcodeRaw = String(options.stockChangeBarcode ?? '').trim()
      /** ISO único para movimiento `date` y `barcodeVerifiedAt` cuando hay ajuste de cantidad válido. */
      let stockAdjustVerifiedAtIso = null
      if (
        Object.prototype.hasOwnProperty.call(partial, 'quantity') &&
        partial.quantity !== undefined
      ) {
        const target = products.find((p) => p.id === productId)
        if (target) {
          const beforeCheck = Math.max(0, Number(target.quantity) || 0)
          const afterCheck = Math.max(0, Number(partial.quantity) || 0)
          if (beforeCheck !== afterCheck) {
            if (!stockReasonRaw) return
            if (!isBarcodeEligibleForManualAdjust(target.barcode)) return
            if (!barcodesMatchForManualAdjust(target.barcode, stockChangeBarcodeRaw)) return
            stockAdjustVerifiedAtIso = new Date().toISOString()
          }
        }
      }
      let verificationAudit = null
      /** @type {null | Record<string, unknown>} */
      let quantityMovementDraft = null

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p
          const updates = { ...partial }
          if ('quantity' in updates && updates.quantity !== undefined) {
            updates.quantity = Math.max(0, Number(updates.quantity) || 0)
            const beforeQty = Math.max(0, Number(p.quantity) || 0)
            const afterQty = updates.quantity
            if (beforeQty !== afterQty && stockReasonRaw && stockAdjustVerifiedAtIso) {
              const versionBefore = p.version ?? 1
              quantityMovementDraft = {
                productId: p.id,
                productName: p.name,
                codigoInventario: String(p.codigoInventario ?? p.sku ?? ''),
                type: MOVEMENT_TYPE_ADJUST_QUANTITY,
                quantityDelta: afterQty - beforeQty,
                quantityBefore: beforeQty,
                quantityAfter: afterQty,
                versionBefore,
                versionAfter: versionBefore + 1,
                responsible: actor,
                reason: stockReasonRaw,
                retail: null,
                date: stockAdjustVerifiedAtIso,
                source: MOVEMENT_SOURCE_MANUAL_SCAN_UI,
                barcodeValidated: true,
                verificationMethod: 'barcode_scan',
                barcodeVerifiedAt: stockAdjustVerifiedAtIso,
              }
            }
          }
          if ('estadoVerificacion' in updates) {
            const oldE = p.estadoVerificacion ?? 'teorico'
            const newE = updates.estadoVerificacion
            if (oldE !== newE) {
              const sku = p.codigoInventario ?? p.sku ?? '—'
              verificationAudit = {
                usuario: actor,
                accion: 'Cambio de estado de verificación',
                actionType: 'VERIFICATION_STATUS_UPDATE',
                productoId: p.id,
                sku,
                targetSku: sku,
                detalle: `"${p.name}" (${sku}): ${labelEstadoVerificacion(oldE)} → ${labelEstadoVerificacion(newE)}`,
                reversible: false,
                metadata: {
                  estadoAnterior: oldE,
                  estadoNuevo: newE,
                  estadoAnteriorLabel: labelEstadoVerificacion(oldE),
                  estadoNuevoLabel: labelEstadoVerificacion(newE),
                },
              }
            }
          }
          return { ...p, ...updates, version: (p.version ?? 1) + 1 }
        })
      )

      if (quantityMovementDraft) {
        const d = quantityMovementDraft
        const sku = d.codigoInventario || '—'
        setMovements((m) => {
          const nid = nextMovementId(m)
          const { versionBefore: _vb, versionAfter: _va, ...movementFields } = d
          return [...m, { id: nid, ...movementFields }]
        })
        logAuditEvent({
          usuario: actor,
          accion: 'Ajuste de Cantidad (ficha)',
          actionType: 'STOCK_ADJUST',
          targetSku: sku,
          previousValue: d.quantityBefore,
          newValue: d.quantityAfter,
          detalle: `"${d.productName}" (${sku}): ${d.quantityBefore} → ${d.quantityAfter} uds. Motivo: ${d.reason}. Verificación: escaneo de barcode.`,
          productoId: d.productId,
          sku,
          estadoAnterior: { quantity: d.quantityBefore, version: d.versionBefore },
          estadoNuevo: { quantity: d.quantityAfter, version: d.versionAfter },
          reversible: true,
          metadata: {
            kardexType: MOVEMENT_TYPE_ADJUST_QUANTITY,
            kardexSource: MOVEMENT_SOURCE_MANUAL_SCAN_UI,
            reason: d.reason,
            barcodeValidated: true,
            verificationMethod: 'barcode_scan',
            barcodeVerifiedAt: d.barcodeVerifiedAt,
          },
        })
      }

      if (verificationAudit) {
        logAuditEvent(verificationAudit)
      }
    },
    [logAuditEvent, products]
  )

  const addProductImages = useCallback((productId, newImageUrls) => {
    if (!productId || !Array.isArray(newImageUrls) || newImageUrls.length === 0) return
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              imagenesReferenciales: [...(p.imagenesReferenciales ?? []), ...newImageUrls],
              version: (p.version ?? 1) + 1,
            }
          : p
      )
    )
  }, [])

  const clearAllProductImages = useCallback(() => {
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        imagenesReferenciales: [],
        version: (p.version ?? 1) + 1,
      }))
    )
  }, [])

  const addMovement = useCallback(
    (productId, { type, delta, responsible, reason, retail, date, unitId }) => {
      if (!productId || delta === 0) return
      const product = products.find((p) => p.id === productId)
      if (!product) return
      const resolvedDate = date ? new Date(date) : new Date()
      const responsibleStr = String(responsible || '').trim() || '—'
      const reasonStr = String(reason || '').trim() || '—'
      const retailStr = String(retail || '').trim() || null
      const deltaNum = Number(delta)
      const currentQty = Number(product.quantity) || 0
      const newQty = Math.max(0, currentQty + deltaNum)
      const movementPayload = {
        productId: product.id,
        productName: product.name,
        codigoInventario: product.codigoInventario ?? product.sku,
        unitId: unitId ? String(unitId) : null,
        type,
        quantityDelta: deltaNum,
        quantityBefore: currentQty,
        quantityAfter: newQty,
        responsible: responsibleStr,
        reason: reasonStr,
        retail: retailStr,
        date: resolvedDate.toISOString(),
        source: MOVEMENT_SOURCE_MANUAL_TRAZABILIDAD,
      }
      setMovements((m) => [...m, { id: nextMovementId(m), ...movementPayload }])
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                quantity: newQty,
                version: (p.version ?? 1) + 1,
              }
            : p
        )
      )
    },
    [products]
  )

  /**
   * Case B: Register a return (or any entry) for an SKU that does not exist.
   * Creates a new asset with quantity 1 and records the movement. Asset count increases by 1.
   * @param {{ codigoInventario: string, name: string, description?: string, type: string, responsible: string, reason: string, date?: string }} data
   * @returns {{ newId: number, productName: string, codigoInventario: string }} For audit logging.
   */
  const registerReturnNewSku = useCallback(
    (data) => {
      const sku = String(data.codigoInventario ?? data.sku ?? '').trim()
      const name = String(data.name ?? '').trim() || sku || 'Nuevo activo'
      if (!sku) return null
      const newId = nextId(products)
      const resolvedDate = data.date ? new Date(data.date) : new Date()
      const responsibleStr = String(data.responsible || '').trim() || '—'
      const reasonStr = String(data.reason || '').trim() || '—'

      const usedBarcodes = new Set(products.map((p) => String(p.barcode ?? '').trim()).filter(Boolean))
      const resolved = resolveBarcode(sku, data.barcode, usedBarcodes)
      const newProduct = {
        id: newId,
        name,
        sku,
        codigoInventario: sku,
        barcode: resolved.barcode,
        ubicacionFisica: normalizeUbicacionFisica(data.ubicacionFisica),
        detalleUbicacion: String(data.detalleUbicacion ?? '').trim(),
        tipoBien: 'mueble',
        description: String(data.description ?? '').trim(),
        quantity: 1,
        price: 0,
        cost: 0,
        valorLibros: 0,
        estadoVerificacion: 'teorico',
        especificaciones: '',
        caracteristicas: '',
        composicion: '',
        material: '',
        formato: '',
        origen: '',
        tamano: '',
        certificaciones: '',
        imagenesReferenciales: [],
        version: 1,
      }
      const movementPayload = {
        productId: newId,
        productName: name,
        codigoInventario: sku,
        type: data.type || 'devolucion_cliente_retail',
        quantityDelta: 1,
        quantityBefore: 0,
        quantityAfter: 1,
        responsible: responsibleStr,
        reason: reasonStr,
        date: resolvedDate.toISOString(),
        source: MOVEMENT_SOURCE_MANUAL_TRAZABILIDAD,
      }
      setProducts((prev) => [...prev, newProduct])
      setMovements((m) => [...m, { id: nextMovementId(m), ...movementPayload }])
      return { newId, productName: name, codigoInventario: sku }
    },
    [products]
  )

  /**
   * Genera y persiste unidades serializadas para etiquetado DataMatrix.
   * @param {{ productId: number|string, quantity: number|string, actorEmail?: string }} params
   * @returns {{ ok: boolean, items?: Array<Record<string, unknown>>, reason?: string }}
   */
  const generateUnitItems = useCallback(
    ({ productId, quantity, actorEmail }) => {
      const pid = Number(productId)
      const qty = Math.max(0, Number(quantity) || 0)
      if (!pid || qty <= 0) return { ok: false, reason: 'Parámetros inválidos.' }
      const product = products.find((p) => p.id === pid)
      if (!product) return { ok: false, reason: 'Producto no encontrado.' }

      const sku = String(product.codigoInventario ?? product.sku ?? '').trim()
      if (!sku) return { ok: false, reason: 'El producto no tiene SKU/GTIN válido.' }

      const existingSerials = new Set(unitItems.map((u) => String(u.serial ?? '')).filter(Boolean))
      const nowIso = new Date().toISOString()
      const actor = String(actorEmail || '').trim() || 'Felipe Rebolledo'

      const newItems = Array.from({ length: qty }).map(() => {
        const serial = createUniqueSerial(existingSerials)
        existingSerials.add(serial)
        return createSerializedUnit({
          sku,
          serial,
          productId: pid,
          productName: product.name,
          status: 'Disponible - Inventario Inicial',
          ingresoAt: nowIso,
          etiquetaImpresa: false,
        })
      })

      setUnitItems((prev) => [...prev, ...newItems])
      logAuditEvent({
        usuario: actor,
        accion: 'Generación de etiquetas DataMatrix',
        actionType: 'DATAMATRIX_LABEL_GENERATE',
        targetSku: sku,
        sku,
        reversible: false,
        detalle: `Se generaron ${newItems.length} etiqueta(s) unitarias para "${product.name}" (${sku}).`,
        metadata: {
          quantity: newItems.length,
          productId: pid,
        },
      })

      return { ok: true, items: newItems }
    },
    [products, unitItems, logAuditEvent]
  )

  const getAvailableUnitsBySku = useCallback(
    (sku) => {
      const skuStr = String(sku ?? '').trim()
      if (!skuStr) return []
      return unitItems.filter(
        (u) =>
          String(u.sku_maestro ?? u.sku ?? '').trim() === skuStr &&
          String(u.estado ?? u.status ?? '').toLowerCase().includes('disponible')
      )
    },
    [unitItems]
  )

  const updateUnitStatus = useCallback((unitId, nextStatus) => {
    if (!unitId || !nextStatus) return false
    let changed = false
    setUnitItems((prev) =>
      prev.map((u) => {
        if (String(u.id_unidad ?? u.id) !== String(unitId) && String(u.id) !== String(unitId)) return u
        changed = true
        return {
          ...u,
          estado: nextStatus,
          status: nextStatus,
        }
      })
    )
    return changed
  }, [])

  const markUnitsPrinted = useCallback(
    (unitIds, options = {}) => {
      const ids = Array.isArray(unitIds) ? unitIds : []
      const idSet = new Set(ids.map((x) => String(x ?? '').trim()).filter(Boolean))
      if (idSet.size === 0) return 0

      const actor = String(options.actorEmail ?? '').trim() || 'Sistema'
      let changedCount = 0

      setUnitItems((prev) =>
        prev.map((u) => {
          const uKey = String(u.id_unidad ?? u.id ?? '').trim()
          if (!uKey || !idSet.has(uKey)) return u
          if (u.etiqueta_impresa === true) return u
          changedCount += 1
          return {
            ...u,
            etiqueta_impresa: true,
          }
        })
      )

      if (changedCount > 0) {
        // Audit suave (sin reversión todavía).
        logAuditEvent({
          usuario: actor,
          accion: 'Impresión masiva de etiquetas DataMatrix',
          actionType: 'LABEL_PRINT',
          targetSku: '',
          reversible: false,
          detalle: `Se marcaron ${changedCount} unidad(es) con etiqueta_impresa: true.`,
          metadata: { unitIds: ids },
        })
      }

      return changedCount
    },
    [logAuditEvent]
  )

  const clearUnitItems = useCallback(
    (options = {}) => {
      const actor = String(options.actorEmail ?? '').trim() || 'Sistema'
      setUnitItems([])
      logAuditEvent({
        usuario: actor,
        accion: 'Limpieza de unidades serializadas (localStorage inventory_units)',
        actionType: 'UNITS_CLEAR',
        reversible: false,
        detalle: 'Se eliminaron todas las unidades serializadas de la llave local inventory_units.',
      })
    },
    [logAuditEvent]
  )

  const resetToInitial = useCallback(() => {
    setProducts(initialProducts)
    setMovements([])
    setAuditEvents([])
    setUnitItems([])
  }, [])

  const value = {
    products,
    movements,
    auditEvents,
    unitItems,
    addBienesFromImport,
    vaciarInventario,
    clearUnitItems,
    addProduct,
    updateProduct,
    addProductImages,
    clearAllProductImages,
    addMovement,
    registerReturnNewSku,
    generateUnitItems,
    getAvailableUnitsBySku,
    updateUnitStatus,
    markUnitsPrinted,
    logAuditEvent,
    revertAuditEvent,
    resetToInitial,
    totalCount: products.length,
    /** Suma de todas las cantidades (unidades en stock). Siempre numérico para evitar concatenación. */
    totalUnidades: products.reduce((sum, p) => sum + Math.max(0, Number(p.quantity) || 0), 0),
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}
