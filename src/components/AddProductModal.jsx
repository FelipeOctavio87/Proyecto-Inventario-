import { useState } from 'react'
import { useInventory } from '../context/InventoryContext'
import {
  TIPO_BIEN,
  ESTADO_VERIFICACION,
  UBICACION_FISICA_OPTIONS,
  DEFAULT_UBICACION_FISICA,
} from '../types/product'

const AddProductModal = ({ onClose }) => {
  const { addProduct } = useInventory()
  const [form, setForm] = useState({
    name: '',
    codigoInventario: '',
    barcode: '',
    tipoBien: 'mueble',
    description: '',
    quantity: 1,
    valorLibros: 0,
    estadoVerificacion: 'teorico',
    ubicacionFisica: DEFAULT_UBICACION_FISICA,
    detalleUbicacion: '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    const numFields = ['quantity', 'valorLibros']
    setForm((prev) => ({
      ...prev,
      [name]: numFields.includes(name) ? (value === '' ? '' : Number(value)) : value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() && !form.codigoInventario.trim()) return
    addProduct({
      ...form,
      quantity: Math.max(0, Number(form.quantity) || 0),
      valorLibros: Math.max(0, Number(form.valorLibros) || 0),
    })
    onClose()
  }

  return (
    <div className="add-product-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
      <div className="add-product-modal">
        <h3 id="add-product-title">Añadir ítem al inventario</h3>
        <form onSubmit={handleSubmit} className="add-product-form">
          <label className="add-product-label">
            Nombre *
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ej. Escritorio oficina"
              className="add-product-input"
            />
          </label>
          <label className="add-product-label">
            Código inventario
            <input
              type="text"
              name="codigoInventario"
              value={form.codigoInventario}
              onChange={handleChange}
              placeholder="Ej. INV-M-001"
              className="add-product-input"
            />
          </label>
          <label className="add-product-label">
            Código de barras (opcional)
            <input
              type="text"
              name="barcode"
              value={form.barcode}
              onChange={handleChange}
              placeholder="Ej. BC-8000008164911 (o EAN/UPC numérico)"
              className="add-product-input"
            />
          </label>
          <label className="add-product-label">
            Tipo de bien
            <select name="tipoBien" value={form.tipoBien} onChange={handleChange} className="add-product-input">
              <option value="mueble">{TIPO_BIEN.mueble}</option>
              <option value="inmueble">{TIPO_BIEN.inmueble}</option>
            </select>
          </label>
          <label className="add-product-label">
            Descripción
            <input
              type="text"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Descripción opcional"
              className="add-product-input"
            />
          </label>
          <label className="add-product-label">
            Cantidad
            <input
              type="number"
              name="quantity"
              min={0}
              value={form.quantity}
              onChange={handleChange}
              className="add-product-input"
            />
          </label>
          <label className="add-product-label">
            Valor en libros
            <input
              type="number"
              name="valorLibros"
              min={0}
              step={1}
              value={form.valorLibros}
              onChange={handleChange}
              className="add-product-input"
            />
          </label>
          <label className="add-product-label">
            Estado verificación
            <select name="estadoVerificacion" value={form.estadoVerificacion} onChange={handleChange} className="add-product-input">
              {Object.entries(ESTADO_VERIFICACION).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <div className="ficha-ubicacion ficha-ubicacion--in-modal" aria-labelledby="ubicacion-bloque-titulo">
            <h4 id="ubicacion-bloque-titulo" className="ficha-ubicacion__title">
              Ubicación Física
            </h4>
            <label className="ficha-ubicacion__label" htmlFor="add-product-ubicacion">
              Bodega <span className="ficha-ubicacion__req">*</span>
            </label>
            <select
              id="add-product-ubicacion"
              name="ubicacionFisica"
              value={form.ubicacionFisica}
              onChange={handleChange}
              className="ficha-ubicacion__select"
              required
            >
              {UBICACION_FISICA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="ficha-ubicacion__label" htmlFor="add-product-detalle-ubicacion">
              Detalle de ubicación <span className="ficha-ubicacion__optional">(opcional)</span>
            </label>
            <textarea
              id="add-product-detalle-ubicacion"
              name="detalleUbicacion"
              value={form.detalleUbicacion}
              onChange={handleChange}
              className="ficha-ubicacion__textarea"
              placeholder="Estante, pasillo, nivel u observaciones"
              rows={3}
            />
          </div>

          <div className="add-product-actions">
            <button type="submit" className="import__btn">Guardar</button>
            <button type="button" className="import__btn import__btn--secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddProductModal
