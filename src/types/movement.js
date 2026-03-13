/**
 * Tipos de movimiento para trazabilidad (Enterprise).
 * Categorías: ENTRADAS (suman), SALIDAS (restan), INTERNOS (signo según usuario).
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
      { value: 'bloqueo_stock', label: 'Bloqueo de Stock (Control de Calidad)' },
    ],
  },
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
