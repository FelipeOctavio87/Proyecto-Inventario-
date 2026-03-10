# Guía de desarrollo backend – Tablas, APIs y servicios

Guía para implementar el backend del sistema de inventario: diseño de tablas, API REST y capa de servicios.

---

## 1. Stack recomendado

| Capa        | Tecnología sugerida | Alternativas        |
|------------|---------------------|---------------------|
| Runtime    | Node.js (LTS)       | —                   |
| Framework  | Express             | Fastify, NestJS     |
| Base de datos | PostgreSQL      | MySQL, SQLite       |
| ORM / SQL  | Prisma o Drizzle   | Knex, typeorm       |
| Validación | Zod                 | Joi, express-validator |
| Variables  | dotenv              | —                   |

---

## 2. Estructura de carpetas

```
backend/
├── src/
│   ├── config/
│   │   └── database.js      # Conexión DB
│   ├── db/
│   │   └── migrations/      # Migraciones (si aplica)
│   ├── models/              # Entidades/ esquemas (Prisma: schema.prisma)
│   ├── repositories/       # Acceso a datos (opcional, si no usas ORM directo)
│   ├── services/           # Lógica de negocio
│   ├── controllers/        # Handlers HTTP, validación de entrada
│   ├── routes/             # Definición de rutas
│   ├── middleware/         # auth, errores, logging
│   ├── utils/              # Helpers
│   └── app.js o index.js   # Express app
├── .env.example
├── package.json
└── README.md
```

Flujo: **Request → Route → Controller → Service → Repository/ORM → DB**.

---

## 3. Diseño de tablas

### 3.1 Tabla `products`

Base para el módulo de productos (alineada al MVP del frontend).

| Columna      | Tipo         | Restricciones   | Descripción           |
|-------------|--------------|-----------------|------------------------|
| id          | UUID o SERIAL | PK, auto        | Identificador único    |
| name        | VARCHAR(255)  | NOT NULL        | Nombre del producto    |
| sku         | VARCHAR(64)  | NOT NULL, UNIQUE| Código SKU             |
| description | TEXT         | nullable        | Descripción            |
| quantity    | INTEGER      | NOT NULL, >= 0  | Cantidad en inventario |
| price       | DECIMAL(10,2)| NOT NULL, >= 0  | Precio de venta        |
| cost        | DECIMAL(10,2)| NOT NULL, >= 0  | Costo del producto     |
| created_at  | TIMESTAMP    | default now()   | Alta                   |
| updated_at  | TIMESTAMP    | default now()   | Última actualización   |

Ejemplo SQL (PostgreSQL):

```sql
CREATE TABLE products (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  sku        VARCHAR(64) NOT NULL UNIQUE,
  description TEXT,
  quantity   INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  price      DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  cost       DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
```

### 3.2 Extensiones futuras (referencia)

- **categories**: id, name → products.category_id (FK).
- **movements** o **stock_movements**: id, product_id, type (in/out), quantity, reason, created_at.
- **users**: si añades autenticación.

---

## 4. Capa de servicios

Los **services** contienen la lógica de negocio y no conocen HTTP. Reciben y devuelven datos (objetos, listas, errores de negocio).

### 4.1 Principios

- Un servicio por dominio (ej: `ProductService`).
- Métodos con nombres de acción: `getAll`, `getById`, `create`, `update`, `delete`.
- Validación de reglas de negocio aquí (o en un paso previo con Zod).
- No usar `req`/`res`; los controllers adaptan HTTP ↔ servicio.

### 4.2 Ejemplo: ProductService

```javascript
// src/services/productService.js

class ProductService {
  constructor(productRepository) {
    this.repo = productRepository
  }

  async getAll() {
    const products = await this.repo.findAll()
    return { data: products }
  }

  async getById(id) {
    const product = await this.repo.findById(id)
    if (!product) {
      const error = new Error('Producto no encontrado')
      error.code = 'NOT_FOUND'
      throw error
    }
    return { data: product }
  }

  async create(payload) {
    const existing = await this.repo.findBySku(payload.sku)
    if (existing) {
      const error = new Error('Ya existe un producto con ese SKU')
      error.code = 'CONFLICT'
      throw error
    }
    const product = await this.repo.create(payload)
    return { data: product }
  }

  async update(id, payload) {
    await this.getById(id) // valida que exista
    const product = await this.repo.update(id, payload)
    return { data: product }
  }

  async delete(id) {
    await this.getById(id)
    await this.repo.delete(id)
    return { deleted: true }
  }
}

module.exports = ProductService
```

Si usas **Prisma**, el “repository” puede ser el cliente Prisma inyectado; si usas SQL plano, será un módulo que ejecute queries.

---

## 5. APIs (REST)

### 5.1 Convenciones

- **Base URL**: `/api/v1` (ej: `http://localhost:4000/api/v1`).
- **Recurso**: sustantivo en plural, ej. `products`.
- **Códigos HTTP**: 200 (OK), 201 (Created), 400 (Bad Request), 404 (Not Found), 409 (Conflict), 500 (Error interno).
- **Cuerpo**: JSON. Respuestas en formato consistente.

### 5.2 Formato de respuesta

```json
{
  "data": { ... }   // o [ ... ] para listas
}
```

Errores:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Producto no encontrado"
  }
}
```

### 5.3 Endpoints de productos

| Método   | Ruta              | Descripción        | Body (JSON) |
|----------|-------------------|--------------------|-------------|
| GET      | /api/v1/products  | Listar productos   | —           |
| GET      | /api/v1/products/:id | Obtener uno     | —           |
| POST     | /api/v1/products  | Crear producto     | name, sku, description, quantity, price, cost |
| PATCH    | /api/v1/products/:id | Actualizar uno  | campos a actualizar    |
| DELETE   | /api/v1/products/:id | Eliminar uno    | —           |

Opcional para coste/ganancia (o calcular en frontend):

| Método | Ruta                        | Descripción              |
|--------|-----------------------------|--------------------------|
| GET    | /api/v1/products/cost-earning | Listado con cost y earning por producto |

### 5.4 Ejemplo de controller

El controller recibe `req`/`res`, valida entrada (ej. con Zod), llama al servicio y mapea resultado/errores a HTTP.

```javascript
// src/controllers/productController.js

const getProducts = async (req, res, next) => {
  try {
    const result = await productService.getAll()
    res.json(result)
  } catch (err) {
    next(err)
  }
}

const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await productService.getById(id)
    res.json(result)
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: err.code, message: err.message } })
    }
    next(err)
  }
}

const createProduct = async (req, res, next) => {
  try {
    const result = await productService.create(req.body)
    res.status(201).json(result)
  } catch (err) {
    if (err.code === 'CONFLICT') {
      return res.status(409).json({ error: { code: err.code, message: err.message } })
    }
    next(err)
  }
}
```

---

## 6. Rutas

```javascript
// src/routes/productRoutes.js

const express = require('express')
const router = express.Router()
const productController = require('../controllers/productController')
const { validateCreateProduct, validateUpdateProduct } = require('../middleware/validateProduct')

router.get('/', productController.getProducts)
router.get('/cost-earning', productController.getCostEarning) // opcional
router.get('/:id', productController.getProductById)
router.post('/', validateCreateProduct, productController.createProduct)
router.patch('/:id', validateUpdateProduct, productController.updateProduct)
router.delete('/:id', productController.deleteProduct)

module.exports = router
```

En `app.js`:

```javascript
const productRoutes = require('./routes/productRoutes')
app.use('/api/v1/products', productRoutes)
```

---

## 7. Validación (Zod)

Ejemplo de esquema y middleware:

```javascript
// src/middleware/validateProduct.js

const z = require('zod')

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().min(1).max(64),
  description: z.string().max(2000).optional(),
  quantity: z.number().int().min(0),
  price: z.number().min(0),
  cost: z.number().min(0),
})

const validateCreateProduct = (req, res, next) => {
  const parsed = createProductSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    })
  }
  req.body = parsed.data
  next()
}
```

---

## 8. Middleware de errores

Un único middleware al final para no duplicar lógica:

```javascript
// src/middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
  console.error(err)
  const code = err.code || 'INTERNAL_ERROR'
  const status = code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : 500
  res.status(status).json({
    error: { code, message: err.message || 'Error interno del servidor' },
  })
}
```

---

## 9. Resumen del flujo

```
Cliente HTTP
    → Route (router)
    → Middleware (validación, auth)
    → Controller (req/res → parámetros → servicio)
    → Service (lógica de negocio)
    → Repository / ORM
    → Base de datos
    ← Controller (formatea respuesta)
    ← Cliente
```

---

## 10. Checklist rápido

- [ ] Tabla `products` con columnas y restricciones definidas.
- [ ] Migraciones o script SQL versionado.
- [ ] Servicio `ProductService` con getAll, getById, create, update, delete.
- [ ] Controller que usa el servicio y mapea códigos HTTP.
- [ ] Rutas bajo `/api/v1/products`.
- [ ] Validación de body (Zod u otra) en POST/PATCH.
- [ ] Middleware de errores global.
- [ ] Variables de entorno (DB URL, PORT) en `.env` y documentadas en `.env.example`.
- [ ] CORS configurado si el frontend corre en otro origen (ej. React en :3000, API en :4000).

Con esta guía puedes implementar las tablas, la capa de servicios y las APIs del backend de forma ordenada y escalable.
