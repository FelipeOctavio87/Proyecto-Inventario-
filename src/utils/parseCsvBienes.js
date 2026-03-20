import { resolveUbicacionFisicaFromCsv } from '../types/product'

/**
 * Parsea CSV de bienes para importación masiva.
 * Espera encabezado: codigoInventario,name,tipoBien,description,quantity,valorLibros,estadoVerificacion
 * Acepta separador coma (,) o punto y coma (;).
 *
 * Reglas SKU (sanitizeSKU): 1–64 caracteres; letras, números, punto, guión bajo y guión medio.
 * No se permiten espacios ni caracteres de control.
 *
 * @param {string} text - Contenido del CSV
 * @returns {{
 *   valid: Array<Object>,
 *   blockingErrors: Array<{ row: number, message: string, code?: string }>,
 *   warnings: Array<{ row: number, message: string, code?: string }>,
 *   totalDataRows: number,
 *   errors: Array<{ row: number, message: string, code?: string }>
 * }}
 */
const normalizeHeader = (h) =>
  String(h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

/**
 * Parsea números presentes en el CSV con distintos formatos (ej: "189990.0", "1.234.567,89").
 * @param {string|number} raw
 * @returns {number}
 */
const parseNumberLike = (raw) => {
  let s = String(raw ?? '').trim()
  if (!s) return NaN

  s = s.replace(/\s+/g, '')

  if (/e/i.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) ? n : NaN
  }

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')

    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const parts = s.split(',')
    if (parts.length > 2) {
      const dec = parts.pop()
      s = parts.join('') + '.' + dec
    } else {
      s = s.replace(',', '.')
    }
  } else if (hasDot) {
    const parts = s.split('.')
    if (parts.length > 2) {
      s = parts.join('')
    }
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return NaN

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

const SKU_MAX_LEN = 64

/**
 * Normaliza y valida SKU/código de inventario (alfanumérico + ._-).
 * @param {string|number} raw
 * @returns {{ value: string, valid: boolean, reason?: string }}
 */
export const sanitizeSKU = (raw) => {
  let s = String(raw ?? '').trim()
  if (!s) return { value: '', valid: false, reason: 'empty' }

  if (/e/i.test(s)) {
    const n = Number(s)
    if (!Number.isNaN(n)) {
      s = Number.isInteger(n) ? String(n) : String(Math.floor(n))
    }
  }

  s = s.replace(/\.0+$/, '')

  if (s.length > SKU_MAX_LEN) {
    return { value: s, valid: false, reason: 'too_long' }
  }

  if (!/^[A-Za-z0-9._-]+$/.test(s)) {
    return { value: s, valid: false, reason: 'invalid_chars' }
  }

  return { value: s, valid: true }
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
    if (n === 'valorlibros' || n === 'valor' || n === 'valorlibro' || n === 'costounitario' || n === 'costo')
      return 'valorLibros'
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

const emptyBlocking = (msg, row = 0, code = 'FILE') => ({
  valid: [],
  blockingErrors: [{ row, message: msg, code }],
  warnings: [],
  totalDataRows: 0,
  errors: [{ row, message: msg, code }],
})

export const parseCsvBienes = (text) => {
  const valid = []
  const blockingErrors = []
  const warnings = []
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    const e = emptyBlocking('El CSV debe tener fila de encabezado y al menos una fila de datos.', 0, 'NO_DATA')
    return e
  }
  const separator = detectSeparator(lines[0])
  const headerLine = parseLine(lines[0], separator)
  const headers = mapHeaders(headerLine)
  const nameIdx = headers.indexOf('name')
  const codigoIdx = headers.indexOf('codigoInventario')
  if (nameIdx === -1 && codigoIdx === -1) {
    return emptyBlocking(
      'Se requiere columna "name" o "nombre" y/o "codigoInventario" o "codigo" / SKU.',
      1,
      'MISSING_COLUMNS'
    )
  }

  const totalDataRows = lines.length - 1

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], separator)
    const row = {}
    headers.forEach((h, j) => {
      const rawValue = values[j] !== undefined ? String(values[j]).trim() : ''
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
    const skuResult = sanitizeSKU(rawCodigo)
    const codigo = skuResult.value
    if (rawCodigo.trim() !== '' && !skuResult.valid) {
      const msg =
        skuResult.reason === 'too_long'
          ? `SKU demasiado largo (máx. ${SKU_MAX_LEN} caracteres).`
          : skuResult.reason === 'invalid_chars'
            ? 'SKU inválido: use solo letras, números, punto, guión o guión bajo (sin espacios).'
            : 'SKU inválido.'
      blockingErrors.push({ row: i + 1, message: msg, code: 'SKU_INVALID' })
      continue
    }

    const rawBarcode = String(row.barcode ?? '').trim()
    let barcode = rawBarcode
    if (rawBarcode) {
      const barcodeValid = rawBarcode.length > 3 && !/\s/.test(rawBarcode) && /^[A-Za-z0-9-]+$/.test(rawBarcode)
      if (!barcodeValid) {
        warnings.push({
          row: i + 1,
          message: `Barcode con formato inválido; se importará sin barcode de CSV: "${rawBarcode}".`,
          code: 'BARCODE_WARN',
        })
        barcode = ''
      }
    }
    const name = (row.name || '').trim() || codigo || `Bien ${i + 1}`
    if (!name.trim() && !codigo) {
      blockingErrors.push({ row: i + 1, message: 'Falta nombre y código del bien.', code: 'ROW_EMPTY' })
      continue
    }
    const quantityParsed = parseNumberLike(row.quantity)
    const quantity = Number.isFinite(quantityParsed) ? quantityParsed : 0

    const valorParsed = parseNumberLike(row.valorLibros)
    const valorLibros = Number.isFinite(valorParsed) ? valorParsed : 0

    const priceParsed = parseNumberLike(row.price)
    const price = Number.isFinite(priceParsed) ? priceParsed : 0

    const rawEstadoVerificacion = String(row.estadoVerificacion ?? '').trim()

    if (quantity < 0) {
      blockingErrors.push({ row: i + 1, message: 'Cantidad no puede ser negativa.', code: 'QTY_NEGATIVE' })
      continue
    }
    valid.push({
      sourceRow: i + 1,
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
      /** Si la columna venía vacía, en modo actualización no se pisa el estado existente del bien. */
      estadoVerificacionProvided: rawEstadoVerificacion !== '',
    })
  }

  const errors = [...blockingErrors, ...warnings]
  return {
    valid,
    blockingErrors,
    warnings,
    totalDataRows,
    errors,
  }
}

/**
 * Genera CSV descargable con incidencias de importación.
 * @param {Array<{ row: number, message: string, code?: string }>} blocking
 * @param {Array<{ row: number, message: string, code?: string }>} warns
 */
export const buildImportIssuesCsv = (blocking, warns) => {
  const sep = ';'
  const header = ['tipo', 'fila', 'codigo', 'mensaje'].join(sep)
  const esc = (s) => {
    const t = String(s ?? '').replace(/"/g, '""')
    return `"${t}"`
  }
  const lines = [header]
  ;(blocking || []).forEach((e) => {
    lines.push(['bloqueante', e.row, e.code || '', esc(e.message)].join(sep))
  })
  ;(warns || []).forEach((e) => {
    lines.push(['advertencia', e.row, e.code || '', esc(e.message)].join(sep))
  })
  return lines.join('\r\n')
}

/**
 * Analiza impacto de importación: duplicados de SKU dentro del CSV (última fila gana si no bloquea)
 * y conteo de filas nuevas vs actualización frente al inventario actual.
 *
 * @param {Array<Object>} valid - Filas válidas de parseCsvBienes (con sourceRow)
 * @param {Array<Object>} existingProducts - productos actuales
 * @param {{ overwrite: boolean, blockDuplicateSkuInCsv: boolean }} options
 */
export const computeImportPlan = (valid, existingProducts, options = {}) => {
  const overwrite = !!options.overwrite
  const blockDuplicateSkuInCsv = !!options.blockDuplicateSkuInCsv

  const skuToLastRow = new Map()
  const skuToFirstSourceRow = new Map()
  const csvDuplicateWarnings = []
  const csvDuplicateBlocking = []

  for (const row of valid) {
    const sku = String(row.codigoInventario ?? row.sku ?? '').trim()
    const src = row.sourceRow ?? 0
    if (!sku) continue

    if (skuToLastRow.has(sku)) {
      const firstRow = skuToFirstSourceRow.get(sku)
      const msg = `SKU duplicado en el CSV (fila ${src}; primera aparición fila ${firstRow}). Por defecto se aplica la última fila de cada SKU.`
      if (blockDuplicateSkuInCsv) {
        csvDuplicateBlocking.push({
          row: src,
          message: `${msg} Corrige el archivo o desactiva «Bloquear si hay SKU duplicado en el CSV».`,
          code: 'CSV_DUP_SKU_BLOCK',
        })
      } else {
        csvDuplicateWarnings.push({
          row: src,
          message: msg,
          code: 'CSV_DUP_SKU',
        })
      }
    } else {
      skuToFirstSourceRow.set(sku, src)
    }
    skuToLastRow.set(sku, row)
  }

  const appliedRows = [...skuToLastRow.values()]

  let newCount = 0
  let updateCount = 0
  if (overwrite) {
    newCount = appliedRows.length
  } else {
    const existingSkus = new Set(
      (existingProducts || []).map((p) => String(p.codigoInventario ?? p.sku ?? '').trim()).filter(Boolean)
    )
    for (const row of appliedRows) {
      const sku = String(row.codigoInventario ?? row.sku ?? '').trim()
      if (existingSkus.has(sku)) updateCount += 1
      else newCount += 1
    }
  }

  return {
    appliedRows,
    csvDuplicateWarnings,
    csvDuplicateBlocking,
    stats: {
      newCount,
      updateCount,
      appliedCount: appliedRows.length,
      inputValidCount: valid.length,
    },
  }
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
 * @param {string} csvText
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
