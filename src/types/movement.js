/**
 * Tipos de movimiento para trazabilidad (Enterprise).
 * Categorías: ENTRADAS (suman), SALIDAS (restan), INTERNOS (signo según usuario).
 */

/**
 * Registro de movimiento de inventario (kardex) persistido en el snapshot.
 * Campos base siempre presentes en flujos nuevos; opcionales en datos antiguos.
 *
 * @typedef {Object} InventoryMovementRecord
 * @property {number} id
 * @property {number} productId
 * @property {string} productName
 * @property {string} codigoInventario
 * @property {string} type - Valor de MOVEMENT_CATEGORIES (p. ej. importacion_csv, recepcion_proveedor).
 * @property {number} quantityDelta
 * @property {number} quantityAfter
 * @property {number} [quantityBefore] - Recomendado; import CSV y futuras rutas lo rellenan.
 * @property {string} responsible
 * @property {string} reason
 * @property {string|null} [retail]
 * @property {string} date - ISO
 * @property {string|null} [correlationId] - Lotes de importación CSV.
 * @property {string} [source] - csv_import | manual_ui | manual_scan_ui | manual_trazabilidad, etc.
 * @property {boolean} [barcodeValidated] - Ajuste desde ficha con escaneo verificado.
 * @property {string} [verificationMethod] - p. ej. 'barcode_scan'.
 * @property {string} [barcodeVerifiedAt] - ISO; no se persiste el valor escaneado.
 */

/** @typedef {'entrada' | 'salida' | 'interno'} MovementCategory */

/**
 * Estructura categorizada de tipos de movimiento.
 * sign: 'entrada' => cantidad siempre positiva al stock | 'salida' => siempre negativa | 'interno' => usuario ingresa +/-
 */
export const MOVEMENT_CATEGORIES = {
  ENTRADAS: {
    label: 'ENTRADAS',
    sign: 'entrada',
    types: [
      { value: 'recepcion_proveedor', label: 'Recepción de Proveedor' },
      { value: 'devolucion_cliente_retail', label: 'Devolución de Cliente (Retail)' },
      { value: 'ingreso_ajuste', label: 'Ingreso por Ajuste' },
    ],
  },
  SALIDAS: {
    label: 'SALIDAS',
    sign: 'salida',
    types: [
      { value: 'venta', label: 'Venta' },
      { value: 'merma_dano', label: 'Salida por Merma/Daño' },
      { value: 'vencimiento', label: 'Vencimiento' },
      { value: 'devolucion_proveedor', label: 'Devolución a Proveedor' },
    ],
  },
  INTERNOS: {
    label: 'INTERNOS',
    sign: 'interno',
    types: [
      { value: 'transferencia_bodegas', label: 'Transferencia entre Bodegas' },
      { value: 'ajuste_auditoria', label: 'Ajuste por Auditoría' },
      { value: 'ajuste_pistola', label: 'Ajuste por pistola lectora' },
      { value: 'bloqueo_stock', label: 'Bloqueo de Stock (Control de Calidad)' },
      /** Ajuste de cantidad vía importación CSV (modo actualización / merge por SKU). */
      { value: 'importacion_csv', label: 'Importación CSV (actualización)' },
      /** Legado: ajustes desde ficha antes de escaneo obligatorio. */
      { value: 'ajuste_manual', label: 'Ajuste manual (ficha)' },
      /** Ajuste de cantidad desde ficha con confirmación por escaneo de barcode. */
      { value: 'ajuste_cantidad', label: 'Ajuste de Cantidad' },
    ],
  },
}

/** Tipo y origen usados al generar movimientos desde `addBienesFromImport` (merge). */
export const MOVEMENT_TYPE_CSV_IMPORT = 'importacion_csv'
export const MOVEMENT_SOURCE_CSV_IMPORT = 'csv_import'

/** @deprecated Legado; nuevos movimientos desde ficha usan ajuste_cantidad / manual_scan_ui. */
export const MOVEMENT_TYPE_MANUAL_UI = 'ajuste_manual'
export const MOVEMENT_SOURCE_MANUAL_UI = 'manual_ui'

/** Ajuste de Cantidad desde ficha (`updateProduct` + escaneo barcode). */
export const MOVEMENT_TYPE_ADJUST_QUANTITY = 'ajuste_cantidad'
export const MOVEMENT_SOURCE_MANUAL_SCAN_UI = 'manual_scan_ui'

/** Movimientos registrados desde Trazabilidad / pistola (`addMovement`). */
export const MOVEMENT_SOURCE_MANUAL_TRAZABILIDAD = 'manual_trazabilidad'

/** Etiquetas cortas para columna «Origen» en historial (UI). */
export const MOVEMENT_SOURCE_LABELS = {
  [MOVEMENT_SOURCE_CSV_IMPORT]: 'CSV',
  [MOVEMENT_SOURCE_MANUAL_SCAN_UI]: 'Ficha',
  [MOVEMENT_SOURCE_MANUAL_UI]: 'Ficha',
  [MOVEMENT_SOURCE_MANUAL_TRAZABILIDAD]: 'Trazabilidad',
}

/** Tipos que exigen motivo obligatorio */
export const TYPES_REQUIRING_REASON = ['merma_dano', 'vencimiento']

/** Mapa valor → etiqueta para historial y validaciones */
export const MOVEMENT_TYPE_LABELS = {}
Object.values(MOVEMENT_CATEGORIES).forEach((cat) => {
  cat.types.forEach((t) => {
    MOVEMENT_TYPE_LABELS[t.value] = t.label
  })
})

/**
 * Origen legible para un movimiento persistido (no altera el modelo; heurística si falta `source`).
 * Debe declararse después de poblar MOVEMENT_TYPE_LABELS.
 * @param {{ source?: string, type?: string }} movement
 * @returns {string}
 */
export function getMovementOriginLabel(movement) {
  const m = movement || {}
  const raw = String(m.source ?? '').trim()
  if (raw) {
    if (raw === MOVEMENT_SOURCE_MANUAL_TRAZABILIDAD && m.type === 'ajuste_pistola') {
      return 'Pistola'
    }
    if (Object.prototype.hasOwnProperty.call(MOVEMENT_SOURCE_LABELS, raw)) {
      return MOVEMENT_SOURCE_LABELS[raw]
    }
    return raw
  }
  if (m.type === MOVEMENT_TYPE_CSV_IMPORT) return MOVEMENT_SOURCE_LABELS[MOVEMENT_SOURCE_CSV_IMPORT]
  if (m.type === MOVEMENT_TYPE_ADJUST_QUANTITY || m.type === MOVEMENT_TYPE_MANUAL_UI) {
    return MOVEMENT_SOURCE_LABELS[MOVEMENT_SOURCE_MANUAL_SCAN_UI]
  }
  if (m.type === 'ajuste_pistola') return 'Pistola'
  if (m.type && Object.prototype.hasOwnProperty.call(MOVEMENT_TYPE_LABELS, m.type)) {
    return MOVEMENT_SOURCE_LABELS[MOVEMENT_SOURCE_MANUAL_TRAZABILIDAD]
  }
  return '—'
}

/** Obtiene la categoría (sign) de un tipo */
export function getMovementSign(typeValue) {
  for (const cat of Object.values(MOVEMENT_CATEGORIES)) {
    if (cat.types.some((t) => t.value === typeValue)) return cat.sign
  }
  return 'interno'
}

/** Indica si el tipo requiere motivo obligatorio */
export function isReasonRequired(typeValue) {
  return TYPES_REQUIRING_REASON.includes(typeValue)
}
