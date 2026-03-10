/**
 * Contrato de tipo para Producto en el sistema de inventario.
 * @typedef {Object} Product
 * @property {number} id - Identificador único del producto
 * @property {string} name - Nombre del producto
 * @property {string} sku - Código SKU (Stock Keeping Unit)
 * @property {string} description - Descripción detallada del producto
 * @property {number} quantity - Cantidad disponible en inventario
 * @property {number} price - Precio de venta
 * @property {number} cost - Costo del producto
 */

export const ProductShape = {
  id: 0,
  name: '',
  sku: '',
  description: '',
  quantity: 0,
  price: 0,
  cost: 0,
}
