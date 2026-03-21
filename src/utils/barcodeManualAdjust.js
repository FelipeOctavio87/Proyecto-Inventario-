/**
 * Normalización para comparar códigos escaneados vs el barcode del producto:
 * trim, sin espacios internos, minúsculas (case-insensitive).
 * @param {string|undefined|null} value
 * @returns {string}
 */
export function normalizeBarcodeForComparison(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase()
}

/**
 * El bien puede usar "Ajuste de Cantidad" manual: barcode no vacío, >3 chars, alfanumérico + guiones.
 * (Alineado con reglas de formato del inventario; sin espacios tras colapsar.)
 * @param {string|undefined|null} barcode
 * @returns {boolean}
 */
export function isBarcodeEligibleForManualAdjust(barcode) {
  const collapsed = String(barcode ?? '')
    .replace(/\s+/g, '')
    .trim()
  if (!collapsed) return false
  if (collapsed.length <= 3) return false
  return /^[A-Za-z0-9-]+$/.test(collapsed)
}

/**
 * @param {string|undefined|null} expectedProductBarcode
 * @param {string|undefined|null} scannedValue
 * @returns {boolean}
 */
export function barcodesMatchForManualAdjust(expectedProductBarcode, scannedValue) {
  const a = normalizeBarcodeForComparison(expectedProductBarcode)
  const b = normalizeBarcodeForComparison(scannedValue)
  if (!a || !b) return false
  return a === b
}
