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
 */

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
