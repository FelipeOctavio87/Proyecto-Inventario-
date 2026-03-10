/**
 * Datos dummy para el módulo de productos del sistema de inventario.
 * @typedef {Object} Product
 * @property {number} id - Identificador único
 * @property {string} name - Nombre del producto
 * @property {string} sku - Código SKU
 * @property {string} description - Descripción del producto
 * @property {number} quantity - Cantidad en inventario
 * @property {number} price - Precio de venta
 * @property {number} cost - Costo del producto
 */

export const products = [
  {
    id: 1,
    name: 'Laptop HP Pavilion',
    sku: 'SKU-001',
    description: 'Laptop de 15 pulgadas, 8GB RAM, 256GB SSD',
    quantity: 12,
    price: 899.99,
    cost: 620,
  },
  {
    id: 2,
    name: 'Monitor Dell 24"',
    sku: 'SKU-002',
    description: 'Monitor Full HD 1920x1080, panel IPS',
    quantity: 25,
    price: 249.99,
    cost: 165,
  },
  {
    id: 3,
    name: 'Teclado Mecánico',
    sku: 'SKU-003',
    description: 'Teclado mecánico RGB, switches red',
    quantity: 45,
    price: 89.99,
    cost: 48,
  },
  {
    id: 4,
    name: 'Mouse Inalámbrico',
    sku: 'SKU-004',
    description: 'Mouse ergonómico, 1600 DPI, batería recargable',
    quantity: 80,
    price: 34.99,
    cost: 18,
  },
  {
    id: 5,
    name: 'Webcam HD',
    sku: 'SKU-005',
    description: 'Webcam 1080p, micrófono integrado',
    quantity: 18,
    price: 79.99,
    cost: 42,
  },
]
