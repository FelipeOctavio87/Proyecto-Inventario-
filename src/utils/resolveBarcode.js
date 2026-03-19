/**
 * Resuelve el valor del código de barras (barcode) asociado a un SKU.
 * - Usa el valor desde CSV si existe y es válido.
 * - Si viene vacío/no existe: genera BC-{SKU}.
 * - Garantiza unicidad dentro del inventario usando el set de barcodes usados.
 * - En conflicto (duplicado): aplica sufijo incremental BC-{SKU}-{n}.
 *
 * Nota: este proyecto no tiene backend real; este "resolve" funciona como capa reutilizable
 * para la lógica del estado (InventoryContext).
 */

const normalizeSpaces = (value) => String(value ?? '').replace(/\s+/g, '').trim()

const normalizeSkuForDerived = (sku) => {
  const s = normalizeSpaces(sku)
  // Para el fallback "BC-{SKU}" exigimos un sufijo alfanumérico.
  // Conservamos solo letras y números para mantener formato estable.
  return s.replace(/[^A-Za-z0-9]/g, '')
}

const isValidBarcodeFormat = (barcode) => {
  const s = String(barcode ?? '').trim()
  if (!s) return false
  if (s.length <= 3) return false
  // Sin espacios y solo caracteres permitidos (incluye '-' para el prefijo BC-).
  if (/\s/.test(s)) return false
  return /^[A-Za-z0-9-]+$/.test(s)
}

const makeDerivedBarcodeBase = (sku) => {
  const skuAlnum = normalizeSkuForDerived(sku)
  return skuAlnum ? `BC-${skuAlnum}` : ''
}

const pickUniqueWithBase = (base, usedBarcodes) => {
  if (!base) return ''
  if (!usedBarcodes.has(base)) return base
  for (let n = 1; n < 100000; n++) {
    const candidate = `${base}-${n}`
    if (!usedBarcodes.has(candidate)) return candidate
  }
  // Extremadamente improbable, pero evita loops infinitos.
  return `${base}-${Date.now()}`
}

const pickUniqueDerivedWithSuffixOnConflict = (derivedBase, usedBarcodes) => {
  if (!derivedBase) return ''
  for (let n = 1; n < 100000; n++) {
    const candidate = `${derivedBase}-${n}`
    if (!usedBarcodes.has(candidate)) return candidate
  }
  return `${derivedBase}-${Date.now()}`
}

/**
 * @param {string} sku
 * @param {string|undefined|null} csvBarcode
 * @param {Set<string>} usedBarcodes - barcodes ya existentes en el inventario
 * @returns {{
 *  barcode: string,
 *  source: 'csv' | 'auto' | 'invalid_format_fallback' | 'conflict_fallback',
 *  conflictResolved?: boolean,
 *  validationError?: string
 * }}
 */
export function resolveBarcode(sku, csvBarcode, usedBarcodes = new Set()) {
  const derivedBase = makeDerivedBarcodeBase(sku)
  const derivedFallback = derivedBase ? derivedBase : `BC-${normalizeSkuForDerived(sku) || 'UNKNOWN'}`

  const csvCandidateRaw = String(csvBarcode ?? '')
  const csvCandidate = csvCandidateRaw.trim()

  // 2) CSV no incluye barcode o viene vacío => auto-generado.
  if (!csvCandidate) {
    const barcode = pickUniqueWithBase(derivedFallback, usedBarcodes)
    return { barcode, source: 'auto' }
  }

  // 1) CSV sí trae barcode: validar formato base.
  if (!isValidBarcodeFormat(csvCandidate)) {
    const barcode = pickUniqueWithBase(derivedFallback, usedBarcodes)
    return {
      barcode,
      source: 'invalid_format_fallback',
      validationError: `Formato inválido para barcode: "${csvCandidate}".`,
    }
  }

  // 1) Validado: si no está duplicado, usar directamente.
  if (!usedBarcodes.has(csvCandidate)) {
    return { barcode: csvCandidate, source: 'csv' }
  }

  // 1) Conflicto duplicado: aplicar sufijo incremental BC-{SKU}-{n}.
  const barcode = pickUniqueDerivedWithSuffixOnConflict(derivedFallback, usedBarcodes)
  return { barcode, source: 'conflict_fallback', conflictResolved: true }
}

