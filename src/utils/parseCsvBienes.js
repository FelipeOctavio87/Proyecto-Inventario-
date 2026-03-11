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

const mapHeaders = (rawHeaders) => {
  const normalized = rawHeaders.map(normalizeHeader)
  return rawHeaders.map((h, i) => {
    const n = normalized[i]
    if (n === 'codigoinventario' || n === 'codigo' || n === 'sku') return 'codigoInventario'
    if (n === 'nombre' || n === 'name') return 'name'
    if (n === 'tipobien' || n === 'tipo') return 'tipoBien'
    if (n === 'descripcion' || n === 'description') return 'description'
    if (n === 'cantidad' || n === 'quantity') return 'quantity'
    if (n === 'valorlibros' || n === 'valor' || n === 'valorlibro') return 'valorLibros'
    if (n === 'estadoverificacion' || n === 'estado') return 'estadoVerificacion'
    return DEFAULT_HEADERS[i] ?? `col${i}`
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
    const codigo = (row.codigoInventario || row.codigo || row.sku || '').trim()
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

export const CSV_TEMPLATE_HEADER =
  'codigoInventario,name,tipoBien,description,quantity,valorLibros,estadoVerificacion'

export const getCsvTemplateBlob = () => {
  const header = CSV_TEMPLATE_HEADER
  const example =
    'INV-M-2026-0001,Escritorio oficina,mueble,Escritorio metálico,1,85000,teorico'
  const csv = [header, example].join('\n')
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
}
