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
  'description',
  'quantity',
  'valorLibros',
  'estadoVerificacion',
]

const normalizeHeader = (h) => String(h).trim().toLowerCase().replace(/\s+/g, '')

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
    if (n === 'descripcion' || n === 'description') return 'description'
    if (n === 'cantidad' || n === 'quantity' || n === 'unidades') return 'quantity'
    if (n === 'valorlibros' || n === 'valor' || n === 'valorlibro' || n === 'costounitario' || n === 'costo') return 'valorLibros'
    if (n === 'estadoverificacion' || n === 'estado') return 'estadoVerificacion'
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
      row[h] = values[j] !== undefined ? String(values[j]).trim() : ''
    })
    const rawCodigo = row.codigoInventario || row.codigo || row.sku || ''
    const { value: codigo, valid: skuValid } = sanitizeSKU(rawCodigo)
    if (rawCodigo.trim() !== '' && !skuValid) {
      errors.push({ row: i + 1, message: 'SKU Inválido.' })
      continue
    }
    const name = (row.name || '').trim() || codigo || `Bien ${i + 1}`
    if (!name) {
      errors.push({ row: i + 1, message: 'Falta nombre o código del bien.' })
      continue
    }
    const quantity = Number(row.quantity) || 0
    const valorLibros = Number(String(row.valorLibros || '0').replace(/\./g, '').replace(',', '.')) || 0
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
      quantity,
      valorLibros,
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
  'description',
  'quantity',
  'valorLibros',
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
  'codigoInventario,name,tipoBien,description,quantity,valorLibros,estadoVerificacion'

export const getCsvTemplateBlob = () => {
  const header = CSV_TEMPLATE_HEADER
  const example =
    'INV-M-2026-0001,Escritorio oficina,mueble,Escritorio metálico,1,85000,teorico'
  const csv = [header, example].join('\n')
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
}
