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

export const InventoryProvider = ({ children }) => {
  const [products, setProducts] = useState(initialProducts)

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
      }))
      return [...prev, ...newItems]
    })
  }, [])

  const addProductImages = useCallback((productId, newImageUrls) => {
    if (!productId || !Array.isArray(newImageUrls) || newImageUrls.length === 0) return
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, imagenesReferenciales: [...(p.imagenesReferenciales ?? []), ...newImageUrls] }
          : p
      )
    )
  }, [])

  const resetToInitial = useCallback(() => {
    setProducts(initialProducts)
  }, [])

  const value = {
    products,
    addBienesFromImport,
    addProductImages,
    resetToInitial,
    totalCount: products.length,
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}
