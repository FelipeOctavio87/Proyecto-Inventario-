import { useState, useMemo } from 'react'

const PAGE_SIZE = 50

/**
 * Paginación para listas grandes (ej. 9.000 bienes).
 * @param {Array} items - Lista completa
 * @param {number} pageSize - Items por página
 * @returns {{ pageItems: Array, currentPage: number, totalPages: number, totalCount: number, setPage: Function, nextPage: Function, prevPage: Function, from: number, to: number }}
 */
export const usePagination = (items, pageSize = PAGE_SIZE) => {
  const [currentPage, setCurrentPage] = useState(1)
  const totalCount = items.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const from = (safePage - 1) * pageSize
  const to = Math.min(from + pageSize, totalCount)

  const pageItems = useMemo(
    () => items.slice(from, from + pageSize),
    [items, from, pageSize]
  )

  const setPage = (p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)))
  const nextPage = () => setPage(safePage + 1)
  const prevPage = () => setPage(safePage - 1)

  return {
    pageItems,
    currentPage: safePage,
    totalPages,
    totalCount,
    setPage,
    nextPage,
    prevPage,
    from: totalCount === 0 ? 0 : from + 1,
    to,
    pageSize,
  }
}
