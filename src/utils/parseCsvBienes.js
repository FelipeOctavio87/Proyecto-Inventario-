import { resolveUbicacionFisicaFromCsv } from '../types/product'

/**
 * Parsea CSV de bienes para importación masiva.
 * Espera encabezado: codigoInventario,name,tipoBien,description,quantity,valorLibros,estadoVerificacion
 * Acepta separador coma (,) o punto y coma (;).
 * @param {string} text - Contenido del CSV
 * @returns {{ valid: Array<Object>, errors: Array<{ row: number, message: string }> }}
 */
const DEFAULT_HEADERS = [
  'codigoInventario',
  'name',
  'tipoBien',
  'barcode',
  'description',
  'quantity',
  'valorLibros',
  'estadoVerificacion',
]

const normalizeHeader = (h) =>
  String(h ?? '')
    .trim()
    .toLowerCase()
    // Quitar tildes/diacríticos para que "Precio venta unitario" y similares calcen con las reglas.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Eliminar separadores (espacios, guiones, comas, etc.)
    .replace(/[^a-z0-9]/g, '')

/**
 * Parsea números presentes en el CSV con distintos formatos (ej: "189990.0", "1.234.567,89").
 * Retorna NaN si no es posible parsear.
 * @param {string|number} raw
 * @returns {number}
 */
const parseNumberLike = (raw) => {
  let s = String(raw ?? '').trim()
  if (!s) return NaN

  // Quitar separadores de espacio accidental
  s = s.replace(/\s+/g, '')

  // Evitar problemas con notación científica
  if (/e/i.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) ? n : NaN
  }

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    // Caso mixto: decidimos decimal según cuál aparece más al final.
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')

    if (lastComma > lastDot) {
      // Decimal con coma (ej: 1.234.567,89)
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // Decimal con punto (ej: 1,234,567.89)
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Decimal con coma (posible miles con coma también)
    const parts = s.split(',')
    if (parts.length > 2) {
      // Ej: 1,234,567,89 -> 1234567.89
      const dec = parts.pop()
      s = parts.join('') + '.' + dec
    } else {
      s = s.replace(',', '.')
    }
  } else if (hasDot) {
    // Decimal con punto o miles con punto
    const parts = s.split('.')
    if (parts.length > 2) {
      // Ej: 1.234.567 -> 1234567
      s = parts.join('')
    } else {
      // 189990.0 -> ok (decimal con punto)
    }
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return NaN

  // Si el número es entero (ej: 189990.0) devolvemos como entero para que no quede ".0"
  return Number.isInteger(n) ? n : n
}

const detectSeparator = (firstLine) => {
  const semicolon = (firstLine.match(/;/g) || []).length
  const comma = (firstLine.match(/,/g) || []).length
  return semicolon >= comma ? ';' : ','
}

const parseLine = (line, separator) => {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (!inQuotes && c === separator) {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Sanitiza el SKU/código de inventario para evitar decimales ".0" y notación científica.
 * @param {string|number} raw - Valor crudo del CSV
 * @returns {{ value: string, valid: boolean }} Valor limpio y si es válido (no vacío, solo dígitos)
 */
export const sanitizeSKU = (raw) => {
  let s = String(raw ?? '').trim()
  if (!s) return { value: '', valid: false }

  // Prevención de notación científica: si viene como "8.00000819723E+12" o "1.23e+10"
  if (/e/i.test(s)) {
    const n = Number(s)
    if (!Number.isNaN(n)) {
      s = Number.isInteger(n) ? String(n) : String(Math.floor(n))
    }
  }

  // Quitar punto decimal trailing (ej: 8000008197230.0 → 8000008197230)
  s = s.replace(/\.0+$/, '')

  // Validación: SKU no vacío y solo dígitos (permite códigos numéricos largos como string)
  const valid = s.length > 0 && /^\d+$/.test(s)
  return { value: s, valid }
}

const mapHeaders = (rawHeaders) => {
  const normalized = rawHeaders.map(normalizeHeader)
  return rawHeaders.map((h, i) => {
    const n = normalized[i]
    if (n === 'codigoinventario' || n === 'codigo' || n === 'sku') return 'codigoInventario'
    if (n === 'nombre' || n === 'name' || n === 'producto') return 'name'
    if (n === 'tipobien' || n === 'tipo') return 'tipoBien'
    if (n === 'barcode' || n === 'codigodebarras' || n === 'codigobarras') return 'barcode'
    if (n === 'descripcion' || n === 'description') return 'description'
    if (n === 'cantidad' || n === 'quantity' || n === 'unidades') return 'quantity'
    if (n === 'valorlibros' || n === 'valor' || n === 'valorlibro' || n === 'costounitario' || n === 'costo') return 'valorLibros'
    if (n === 'estadoverificacion' || n === 'estado') return 'estadoVerificacion'
    if (n === 'precioventaunitario' || n === 'precioventa' || n === 'precio' || n === 'price') return 'price'
    if (n === 'ubicacionfisica' || n === 'ubicacion' || n === 'bodega') {
      return 'ubicacionFisica'
    }
    if (n === 'detalleubicacion' || n === 'detalleubicacionfisica' || n === 'detalleubicacin') {
      return 'detalleUbicacion'
    }
    return `col${i}`
  })
}

export const parseCsvBienes = (text) => {
  const valid = []
  const errors = []
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return { valid, errors: [{ row: 0, message: 'El CSV debe tener fila de encabezado y al menos una fila de datos.' }] }
  }
  const separator = detectSeparator(lines[0])
  const headerLine = parseLine(lines[0], separator)
  const headers = mapHeaders(headerLine)
  const nameIdx = headers.indexOf('name')
  const codigoIdx = headers.indexOf('codigoInventario')
  if (nameIdx === -1 && codigoIdx === -1) {
    return {
      valid,
      errors: [{ row: 1, message: 'Se requiere columna "name" o "nombre" y "codigoInventario" o "codigo".' }],
    }
  }
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], separator)
    const row = {}
    headers.forEach((h, j) => {
      const rawValue = values[j] !== undefined ? String(values[j]).trim() : ''
      // Mantener columnas de texto/categoría como string (evita perder ceros a la izquierda en códigos)
      const TEXT_FIELDS = new Set([
        'codigoInventario',
        'name',
        'tipoBien',
        'description',
        'estadoVerificacion',
        'barcode',
        'ubicacionFisica',
        'detalleUbicacion',
      ])
      if (TEXT_FIELDS.has(h)) {
        row[h] = rawValue
        return
      }
      const parsedNumber = parseNumberLike(rawValue)
      row[h] = Number.isFinite(parsedNumber) ? parsedNumber : rawValue
    })
    const rawCodigo = row.codigoInventario || row.codigo || row.sku || ''
    const { value: codigo, valid: skuValid } = sanitizeSKU(rawCodigo)
    if (rawCodigo.trim() !== '' && !skuValid) {
      errors.push({ row: i + 1, message: 'SKU Inválido.' })
      continue
    }

    // Barcode: si viene vacío o no existe => se deja en vacío para fallback.
    // Si viene no vacío y es inválido => se registra error pero se sigue importando.
    const rawBarcode = String(row.barcode ?? '').trim()
    let barcode = rawBarcode
    if (rawBarcode) {
      const barcodeValid = rawBarcode.length > 3 && !/\s/.test(rawBarcode) && /^[A-Za-z0-9-]+$/.test(rawBarcode)
      if (!barcodeValid) {
        errors.push({
          row: i + 1,
          message: `Barcode inválido (formato). Valor recibido: "${rawBarcode}".`,
        })
        barcode = ''
      }
    }
    const name = (row.name || '').trim() || codigo || `Bien ${i + 1}`
    if (!name) {
      errors.push({ row: i + 1, message: 'Falta nombre o código del bien.' })
      continue
    }
    const quantityParsed = parseNumberLike(row.quantity)
    const quantity = Number.isFinite(quantityParsed) ? quantityParsed : 0

    const valorParsed = parseNumberLike(row.valorLibros)
    const valorLibros = Number.isFinite(valorParsed) ? valorParsed : 0

    const priceParsed = parseNumberLike(row.price)
    const price = Number.isFinite(priceParsed) ? priceParsed : 0

    if (quantity < 0) {
      errors.push({ row: i + 1, message: 'Cantidad no puede ser negativa.' })
      continue
    }
    valid.push({
      codigoInventario: codigo || `INV-${i}`,
      sku: codigo || `INV-${i}`,
      name,
      tipoBien: row.tipoBien === 'inmueble' ? 'inmueble' : 'mueble',
      description: (row.description || '').trim(),
      barcode,
      ubicacionFisica: resolveUbicacionFisicaFromCsv(row.ubicacionFisica),
      detalleUbicacion: String(row.detalleUbicacion ?? '').trim(),
      quantity,
      valorLibros,
      price,
      estadoVerificacion: ['teorico', 'verificado_terreno', 'no_encontrado'].includes(row.estadoVerificacion)
        ? row.estadoVerificacion
        : 'teorico',
    })
  }
  return { valid, errors }
}

const KNOWN_FIELDS = new Set([
  'codigoInventario',
  'name',
  'tipoBien',
  'barcode',
  'description',
  'ubicacionFisica',
  'detalleUbicacion',
  'quantity',
  'valorLibros',
  'price',
  'estadoVerificacion',
])

/**
 * Obtiene el mapeo de columnas del CSV (solo primera línea) para mostrar en el panel.
 * @param {string} csvText - Contenido del CSV (o solo la línea de encabezados)
 * @returns {Array<{ rawHeader: string, mappedTo: string, ok: boolean }>}
 */
export const getHeaderMapping = (csvText) => {
  const lines = String(csvText).split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const separator = detectSeparator(lines[0])
  const headerLine = parseLine(lines[0], separator)
  const headers = mapHeaders(headerLine)
  return headerLine.map((raw, i) => ({
    rawHeader: raw,
    mappedTo: headers[i],
    ok: KNOWN_FIELDS.has(headers[i]),
  }))
}

/** Encabezado de ejemplo (Inventario.csv) para mostrar el mapeo por defecto en el panel */
export const EXAMPLE_CSV_HEADER =
  'Producto,SKU,Unidades,Costo unitario,Costo Total,Precio venta unitario,Total Venta'

export const CSV_TEMPLATE_HEADER =
  'codigoInventario,name,tipoBien,description,barcode,ubicacionFisica,detalleUbicacion,quantity,valorLibros,estadoVerificacion'

export const getCsvTemplateBlob = () => {
  const header = CSV_TEMPLATE_HEADER
  const example =
    'INV-M-2026-0001,Escritorio oficina,mueble,Escritorio metálico,,bodega_a_barroso,Estante B2,1,85000,teorico'
  const csv = [header, example].join('\n')
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
}
