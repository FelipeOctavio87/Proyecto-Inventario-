import { useProducts } from '../hooks/useProducts'

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)

const ProductList = () => {
  const { products, loading } = useProducts()

  if (loading) {
    return <p className="product-list__loading">Cargando productos...</p>
  }

  return (
    <section className="product-list">
      <h2 className="product-list__title">Inventario de Productos</h2>
      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>SKU</th>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td>{product.description}</td>
                <td>{product.quantity}</td>
                <td>{formatCurrency(product.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default ProductList
