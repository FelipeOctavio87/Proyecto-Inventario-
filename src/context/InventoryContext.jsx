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

        if (evt.actionType === 'STOCK_ADJUST' && typeof evt.estadoAnterior.quantity === 'number') {
          updated.quantity = evt.estadoAnterior.quantity
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

  const addBienesFromImport = useCallback((rows) => {
    setProducts((prev) => {
      let id = nextId(prev)
      const newItems = rows.map((row) => ({
        id: id++,
        name: row.name ?? '',
        sku: row.codigoInventario ?? row.sku ?? '',
        codigoInventario: row.codigoInventario ?? row.sku ?? '',
        tipoBien: row.tipoBien === 'inmueble' ? 'inmueble' : 'mueble',
        description: row.description ?? '',
        quantity: Math.max(0, Number(row.quantity) || 0),
        price: 0,
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
      return [...prev, ...newItems]
    })
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
      const newQty = Math.max(0, (product.quantity ?? 0) + deltaNum)
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
    addProductImages,
    clearAllProductImages,
    addMovement,
    logAuditEvent,
    revertAuditEvent,
    resetToInitial,
    totalCount: products.length,
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}
