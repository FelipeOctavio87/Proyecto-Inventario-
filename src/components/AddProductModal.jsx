import { useState } from 'react'
import { useInventory } from '../context/InventoryContext'
import { TIPO_BIEN, ESTADO_VERIFICACION } from '../types/product'

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
