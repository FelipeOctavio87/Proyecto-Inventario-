/**
 * Contrato de tipo para Bien/Producto (sistema de gestión de inventario).
 * Incluye campos de ficha técnica y catálogo (especificaciones, material, certificaciones, etc.).
 * @typedef {Object} Product
 * @property {number} id
 * @property {string} name
 * @property {string} sku
 * @property {string} codigoInventario
 * @property {string} tipoBien - 'mueble' | 'inmueble'
 * @property {string} description
 * @property {number} quantity
 * @property {number} price
 * @property {number} cost
 * @property {number} valorLibros
 * @property {string} estadoVerificacion
 * @property {string} [especificaciones] - Ficha técnica
 * @property {string} [caracteristicas]
 * @property {string} [composicion]
 * @property {string} [material]
 * @property {string} [formato]
 * @property {string} [origen]
 * @property {string} [tamano]
 * @property {string} [certificaciones]
 * @property {string[]} [imagenesReferenciales] - URLs de imágenes
 * @property {number} [version] - Versión de control de concurrencia
 * @property {string} [ubicacionFisica] - Código interno de bodega (ver UBICACION_FISICA_OPTIONS)
 * @property {string} [detalleUbicacion] - Detalle opcional (estante, pasillo, nivel, etc.)
 */

/** Opciones fijas de ubicación física (valor estable + etiqueta). */
export const UBICACION_FISICA_OPTIONS = [
  { value: 'bodega_a_barroso', label: 'Bodega A. Barroso' },
  { value: 'bodega_agustinas', label: 'Bodega Agustinas' },
]

/** Valor por defecto si no viene definido (p. ej. CSV antiguo). */
export const DEFAULT_UBICACION_FISICA = 'bodega_a_barroso'

export const ProductShape = {
  id: 0,
  name: '',
  sku: '',
  codigoInventario: '',
  barcode: '',
  tipoBien: 'mueble',
  description: '',
  quantity: 0,
  price: 0,
  cost: 0,
  valorLibros: 0,
  estadoVerificacion: 'teorico',
  ubicacionFisica: DEFAULT_UBICACION_FISICA,
  detalleUbicacion: '',
  especificaciones: '',
  caracteristicas: '',
  composicion: '',
  material: '',
  formato: '',
  origen: '',
  tamano: '',
  certificaciones: '',
  imagenesReferenciales: [],
  version: 1,
}

/** Etiqueta legible para un valor de ubicación física. */
export function labelUbicacionFisica(value) {
  const v = value || DEFAULT_UBICACION_FISICA
  const found = UBICACION_FISICA_OPTIONS.find((o) => o.value === v)
  return found ? found.label : String(v)
}

/**
 * Normaliza texto de CSV u otra fuente a un value de UBICACION_FISICA_OPTIONS.
 * @param {string|undefined|null} raw
 * @returns {string}
 */
export function resolveUbicacionFisicaFromCsv(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return DEFAULT_UBICACION_FISICA
  if (UBICACION_FISICA_OPTIONS.some((o) => o.value === t)) return t
  const lower = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (lower.includes('agustinas')) return 'bodega_agustinas'
  if (lower.includes('barroso')) return 'bodega_a_barroso'
  return DEFAULT_UBICACION_FISICA
}

export const TIPO_BIEN = { mueble: 'Mueble', inmueble: 'Inmueble' }
export const ESTADO_VERIFICACION = {
  teorico: 'Inventario teórico',
  verificado_terreno: 'Verificado en terreno',
  no_encontrado: 'No encontrado',
}

/** Campos de ficha técnica / catálogo para etiquetas en UI */
export const FICHA_TECNICA_LABELS = {
  especificaciones: 'Especificaciones',
  caracteristicas: 'Características',
  composicion: 'Composición',
  material: 'Material',
  formato: 'Formato',
  origen: 'Origen',
  tamano: 'Tamaño',
  certificaciones: 'Certificaciones',
  imagenesReferenciales: 'Imágenes referenciales',
}
