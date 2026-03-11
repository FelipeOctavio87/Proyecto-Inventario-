/**
 * Datos dummy de bienes para el inventario (Municipalidad de Algarrobo / SLEP Litoral).
 * Incluye tipo mueble/inmueble, codificación, valorización y estado de verificación.
 * @typedef {Object} Product
 * @property {number} id
 * @property {string} name
 * @property {string} sku - Código SKU / referencia
 * @property {string} codigoInventario - Codificación para inventario y rotulación
 * @property {string} tipoBien - 'mueble' | 'inmueble'
 * @property {string} description
 * @property {number} quantity
 * @property {number} price
 * @property {number} cost
 * @property {number} valorLibros - Valorización / valor en libros (CLP)
 * @property {string} estadoVerificacion - 'teorico' | 'verificado_terreno' | 'no_encontrado'
 */

export const products = [
  {
    id: 1,
    name: 'Laptop HP Pavilion',
    sku: 'SKU-001',
    codigoInventario: 'INV-M-2026-0001',
    tipoBien: 'mueble',
    description: 'Laptop de 15 pulgadas, 8GB RAM, 256GB SSD',
    quantity: 12,
    price: 899.99,
    cost: 620,
    valorLibros: 750000,
    estadoVerificacion: 'verificado_terreno',
  },
  {
    id: 2,
    name: 'Monitor Dell 24"',
    sku: 'SKU-002',
    codigoInventario: 'INV-M-2026-0002',
    tipoBien: 'mueble',
    description: 'Monitor Full HD 1920x1080, panel IPS',
    quantity: 25,
    price: 249.99,
    cost: 165,
    valorLibros: 220000,
    estadoVerificacion: 'verificado_terreno',
  },
  {
    id: 3,
    name: 'Escritorio oficina',
    sku: 'SKU-003',
    codigoInventario: 'INV-M-2026-0003',
    tipoBien: 'mueble',
    description: 'Escritorio metálico 1,20m',
    quantity: 45,
    price: 89.99,
    cost: 48,
    valorLibros: 85000,
    estadoVerificacion: 'teorico',
  },
  {
    id: 4,
    name: 'Silla ergonómica',
    sku: 'SKU-004',
    codigoInventario: 'INV-M-2026-0004',
    tipoBien: 'mueble',
    description: 'Silla ejecutiva regulable',
    quantity: 80,
    price: 34.99,
    cost: 18,
    valorLibros: 45000,
    estadoVerificacion: 'verificado_terreno',
  },
  {
    id: 5,
    name: 'Oficina dependencia Algarrobo',
    sku: 'INM-001',
    codigoInventario: 'INV-I-2026-0001',
    tipoBien: 'inmueble',
    description: 'Local oficina municipal, 45 m²',
    quantity: 1,
    price: 0,
    cost: 0,
    valorLibros: 12500000,
    estadoVerificacion: 'verificado_terreno',
  },
]
