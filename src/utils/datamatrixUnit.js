const randomChunk = () => Math.random().toString(36).slice(2, 6).toUpperCase()

export const buildGs1LikeCode = (gtin, serial) => `(01)${String(gtin ?? '').trim()}(21)${String(serial ?? '').trim()}`

export const createUniqueSerial = (existing = new Set()) => {
  let candidate = ''
  do {
    candidate = `${Date.now()}${randomChunk()}`
  } while (existing.has(candidate))
  return candidate
}

export const createSerializedUnit = ({
  sku,
  serial,
  status = 'Disponible - Inventario Inicial',
  ingresoAt = new Date().toISOString(),
  productId = null,
  productName = '',
}) => {
  const skuStr = String(sku ?? '').trim()
  const serialStr = String(serial ?? '').trim()
  const gs1LikeCode = buildGs1LikeCode(skuStr, serialStr)
  return {
    id: `unit-${serialStr}`,
    id_unidad: gs1LikeCode,
    sku: skuStr,
    sku_maestro: skuStr,
    serial: serialStr,
    gs1LikeCode,
    estado: status,
    status,
    fecha_ingreso: ingresoAt,
    ingresoAt,
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

