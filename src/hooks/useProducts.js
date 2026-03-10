import { useMemo } from 'react'
import { products } from '../data/products'

/**
 * Hook para obtener la lista de productos.
 * Actualmente usa datos dummy; preparado para migrar a API real.
 * @returns {{ products: Array, loading: boolean }}
 */
export const useProducts = () => {
  const productsData = useMemo(() => products, [])
  const loading = false

  return {
    products: productsData,
    loading,
  }
}
