/**
 * Contrato de tipo para Bien/Producto (inventario SLEP Litoral).
 * @typedef {Object} Product
 * @property {number} id
 * @property {string} name
 * @property {string} sku
 * @property {string} codigoInventario - Codificación inventario / rotulación
 * @property {string} tipoBien - 'mueble' | 'inmueble'
 * @property {string} description
 * @property {number} quantity
 * @property {number} price
 * @property {number} cost
 * @property {number} valorLibros - Valorización (valor en libros)
 * @property {string} estadoVerificacion - 'teorico' | 'verificado_terreno' | 'no_encontrado'
 */

export const ProductShape = {
  id: 0,
  name: '',
  sku: '',
  codigoInventario: '',
  tipoBien: 'mueble',
  description: '',
  quantity: 0,
  price: 0,
  cost: 0,
  valorLibros: 0,
  estadoVerificacion: 'teorico',
}

export const TIPO_BIEN = { mueble: 'Mueble', inmueble: 'Inmueble' }
export const ESTADO_VERIFICACION = {
  teorico: 'Inventario teórico',
  verificado_terreno: 'Verificado en terreno',
  no_encontrado: 'No encontrado',
}
