import { useInventory } from '../context/InventoryContext'

/**
 * Hook para obtener la lista de bienes del inventario.
 * Los datos pueden crecer por importación CSV (hasta ~9.000 activos).
 * @returns {{ products: Array, loading: boolean, totalCount: number }}
 */
export const useProducts = () => {
  const { products, totalCount } = useInventory()
  const loading = false

  return {
    products,
    loading,
    totalCount,
  }
}
