const randomChunk = () => Math.random().toString(36).slice(2, 6).toUpperCase()

export const buildGs1LikeCode = (gtin, serial) =>
  `(01)${String(gtin ?? '').trim()}(21)${String(serial ?? '').trim()}`

/**
 * Serial humano requerido para etiquetas (ej: SN-2026-001).
 * Mantiene unicidad contra el set de seriales existentes.
 */
export const createUniqueSerial = (existing = new Set()) => {
  const year = new Date().getFullYear()
  const used = new Set(
    Array.from(existing).map((s) => String(s ?? '').trim()).filter(Boolean),
  )

  // Recomendado: generar SN-YYYY-XXX con padding 3 dígitos.
  for (let i = 0; i < 5000; i += 1) {
    const num = Math.floor(Math.random() * 999)
    const candidate = `SN-${year}-${String(num).padStart(3, '0')}`
    if (!used.has(candidate)) return candidate
  }

  // Fallback: variante con sufijo aleatorio corto.
  let candidate = ''
  do {
    candidate = `SN-${year}-${randomChunk()}`
  } while (used.has(candidate))
  return candidate
}

export const createSerializedUnit = ({
  sku,
  serial,
  status = 'Disponible - Inventario Inicial',
  ingresoAt = new Date().toISOString(),
  productId = null,
  productName = '',
  etiquetaImpresa = false,
}) => {
  const skuStr = String(sku ?? '').trim()
  const serialStr = String(serial ?? '').trim()
  const gs1LikeCode = buildGs1LikeCode(skuStr, serialStr)

  return {
    id: `unit-${serialStr}`,
    // estándar requerido: (01)SKU(21)SERIAL
    id_unidad: gs1LikeCode,
    sku: skuStr,
    sku_maestro: skuStr,
    serial: serialStr,
    gs1LikeCode,
    estado: status,
    status,
    fecha_ingreso: ingresoAt,
    ingresoAt,
    etiqueta_impresa: !!etiquetaImpresa,
    productId,
    productName,
  }
}

export const parseGs1LikeDataMatrix = (raw) => {
  const value = String(raw ?? '').trim()
  const match = value.match(/^\(01\)([^()]+)\(21\)([^()]+)$/)
  if (!match) return null
  return {
    sku: match[1].trim(),
    serial: match[2].trim(),
    id_unidad: value,
  }
}

