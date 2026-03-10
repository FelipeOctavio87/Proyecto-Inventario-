import { useProducts } from '../hooks/useProducts'

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)

const earningPerUnit = (product) => (product.price ?? 0) - (product.cost ?? 0)
const totalEarning = (product) => earningPerUnit(product) * (product.quantity ?? 0)

const CostEarningTable = () => {
  const { products, loading } = useProducts()

  if (loading) {
    return <p className="cost-earning__loading">Cargando...</p>
  }

  return (
    <section className="cost-earning">
      <h2 className="cost-earning__title">Costo y Ganancia por Producto</h2>
      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>SKU</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Costo</th>
              <th>Ganancia/unidad</th>
              <th>Ganancia total</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td>{product.quantity}</td>
                <td>{formatCurrency(product.price)}</td>
                <td>{formatCurrency(product.cost)}</td>
                <td className="cost-earning__earning">{formatCurrency(earningPerUnit(product))}</td>
                <td className="cost-earning__total">{formatCurrency(totalEarning(product))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default CostEarningTable
