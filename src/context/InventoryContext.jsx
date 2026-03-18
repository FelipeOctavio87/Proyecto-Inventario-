import { createContext, useContext, useState, useCallback } from 'react'
import { products as initialProducts } from '../data/products'

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

export const InventoryProvider = ({ children }) => {
  const [products, setProducts] = useState(initialProducts)
  const [movements, setMovements] = useState([])
  const [auditEvents, setAuditEvents] = useState([])

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
   * @param {Array<Object>} rows - Filas parseadas del CSV
   * @param {{ overwrite?: boolean }} options - overwrite: true = Inventario Inicial (sobrescribe todo), false = Actualización Masiva (añade)
   */
  const addBienesFromImport = useCallback((rows, options = {}) => {
    const overwrite = !!options.overwrite
    setProducts((prev) => {
      const base = overwrite ? [] : prev
      let id = nextId(base)
      const newItems = rows.map((row) => ({
        id: id++,
        name: row.name ?? '',
        sku: row.codigoInventario ?? row.sku ?? '',
        codigoInventario: row.codigoInventario ?? row.sku ?? '',
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
      }))
      return [...base, ...newItems]
    })
  }, [])

  /** Vacía todo el inventario (solo uso Administrador). Reinicia productos, movimientos y auditoría. */
  const vaciarInventario = useCallback(() => {
    setProducts(initialProducts)
    setMovements([])
    setAuditEvents([])
  }, [])

  /** Añade un único bien (para Colaborador: ítem individual). */
  const addProduct = useCallback((product) => {
    if (!product?.name && !product?.codigoInventario) return
    setProducts((prev) => {
      const id = nextId(prev)
      const newItem = {
        id,
        name: product.name ?? '',
        sku: product.codigoInventario ?? product.sku ?? `INV-${id}`,
        codigoInventario: product.codigoInventario ?? product.sku ?? `INV-${id}`,
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

  /** Actualiza un bien existente (p. ej. estado de verificación). */
  const updateProduct = useCallback((productId, partial) => {
    if (!productId || !partial || typeof partial !== 'object') return
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p
        const updates = { ...partial }
        if ('quantity' in updates && updates.quantity !== undefined) {
          updates.quantity = Math.max(0, Number(updates.quantity) || 0)
        }
        return { ...p, ...updates, version: (p.version ?? 1) + 1 }
      })
    )
  }, [])

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
    (productId, { type, delta, responsible, reason, date }) => {
      if (!productId || delta === 0) return
      const product = products.find((p) => p.id === productId)
      if (!product) return
      const resolvedDate = date ? new Date(date) : new Date()
      const responsibleStr = String(responsible || '').trim() || '—'
      const reasonStr = String(reason || '').trim() || '—'
      const deltaNum = Number(delta)
      const currentQty = Number(product.quantity) || 0
      const newQty = Math.max(0, currentQty + deltaNum)
      const movementPayload = {
        productId: product.id,
        productName: product.name,
        codigoInventario: product.codigoInventario ?? product.sku,
        type,
        quantityDelta: deltaNum,
        quantityAfter: newQty,
        responsible: responsibleStr,
        reason: reasonStr,
        date: resolvedDate.toISOString(),
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
      const newProduct = {
        id: newId,
        name,
        sku,
        codigoInventario: sku,
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
        quantityAfter: 1,
        responsible: responsibleStr,
        reason: reasonStr,
        date: resolvedDate.toISOString(),
      }
      setProducts((prev) => [...prev, newProduct])
      setMovements((m) => [...m, { id: nextMovementId(m), ...movementPayload }])
      return { newId, productName: name, codigoInventario: sku }
    },
    [products]
  )

  const resetToInitial = useCallback(() => {
    setProducts(initialProducts)
    setMovements([])
    setAuditEvents([])
  }, [])

  const value = {
    products,
    movements,
    auditEvents,
    addBienesFromImport,
    vaciarInventario,
    addProduct,
    updateProduct,
    addProductImages,
    clearAllProductImages,
    addMovement,
    registerReturnNewSku,
    logAuditEvent,
    revertAuditEvent,
    resetToInitial,
    totalCount: products.length,
    /** Suma de todas las cantidades (unidades en stock). Siempre numérico para evitar concatenación. */
    totalUnidades: products.reduce((sum, p) => sum + Math.max(0, Number(p.quantity) || 0), 0),
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}
