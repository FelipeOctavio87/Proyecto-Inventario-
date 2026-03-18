# Estado actual del Sistema de Gestión de Inventario

## Checklist: funcionalidades listas vs pendientes

### Autenticación y acceso
| Estado | Funcionalidad |
|--------|----------------|
| ✅ | Login con email y rol (Administrador / Colaborador) |
| ✅ | Sesión persistente (localStorage) |
| ✅ | Cerrar sesión y redirección a login |
| ✅ | Rutas protegidas: sin login se redirige a /login |
| ⏳ | Recuperación de contraseña (pendiente) |
| ⏳ | Backend de autenticación real (actualmente solo frontend) |

### Carga de inventario
| Estado | Funcionalidad |
|--------|----------------|
| ✅ | Carga de inventario desde archivo CSV |
| ✅ | Vista previa y mapeo de columnas (código, nombre, tipo, cantidad, valor, etc.) |
| ✅ | Modos: actualización (merge) o reemplazo |
| ✅ | Vaciar inventario (con confirmación) — restricción por rol si aplica |
| ✅ | Resumen de total de ítems y unidades cargadas |
| ⏳ | Validación avanzada de CSV (errores por fila) |
| ⏳ | Persistencia en backend (actualmente estado en memoria/localStorage) |

### Listado de bienes (Bienes)
| Estado | Funcionalidad |
|--------|----------------|
| ✅ | Tabla de productos con nombre, código, tipo, cantidad, valor en libros |
| ✅ | Paginación |
| ✅ | Añadir ítem manual (modal) |
| ✅ | Abrir ficha técnica del producto (modal) |
| ✅ | Edición de cantidades / ajustes desde la lista o flujos asociados |
| ⏳ | Búsqueda/filtros en tabla |
| ⏳ | Exportar lista (CSV/Excel) |

### Valorización de activos
| Estado | Funcionalidad |
|--------|----------------|
| ✅ | Tabla con valor unitario y valor total por producto |
| ✅ | Total general de valorización |
| ✅ | Paginación |
| ⏳ | Gráficos o reportes de valorización |

### Gestión de imágenes
| Estado | Funcionalidad |
|--------|----------------|
| ✅ | Carga masiva: arrastrar imágenes; nombre del archivo = SKU → vinculación automática |
| ✅ | Carga de archivo ZIP: extrae imágenes y vincula por nombre (SKU) |
| ✅ | Gestión por producto: tabla con miniatura, botón Subir (cámara) por fila |
| ✅ | Miniatura clicable para ampliar (lightbox) |
| ✅ | Resumen post-carga: asociadas, sin coincidencia, productos sin foto |
| ✅ | Listado de archivos no asociados (para renombrar y reintentar) |
| ✅ | Limpiar todas las imágenes (con confirmación y auditoría) |
| ✅ | Líneas divisorias entre productos en la tabla “Gestión por producto” |
| ⏳ | Persistencia de imágenes en servidor (actualmente URLs en memoria; se pierden al recargar) |

### Catálogo
| Estado | Funcionalidad |
|--------|----------------|
| ✅ | Vista de fichas técnicas en grid con paginación |
| ✅ | Tarjeta por producto: imagen, nombre, especificaciones, etc. |
| ✅ | Modal de ficha técnica completa (especificaciones, material, certificaciones, imágenes) |
| ⏳ | Filtros por tipo de bien o búsqueda en catálogo |

### Trazabilidad / movimientos
| Estado | Funcionalidad |
|--------|----------------|
| ✅ | Registro de movimientos (entradas/salidas, tipos configurables) |
| ✅ | Devolución/alta de ítem por SKU existente o nuevo (registro de retorno) |
| ✅ | Historial de movimientos por producto o global |
| ✅ | Fecha/hora y zona Chile |
| ⏳ | Persistencia en backend (actualmente en memoria/localStorage) |

### Historial de actividad (auditoría)
| Estado | Funcionalidad |
|--------|----------------|
| ✅ | Registro de eventos (carga de imagen, ajustes, limpieza de imágenes, etc.) |
| ✅ | Listado ordenado por fecha con tipo de acción, SKU, detalle |
| ✅ | Revertir acción cuando es posible (reversible: true) |
| ⏳ | Persistencia de auditoría en backend |
| ⏳ | Filtros por tipo de evento o SKU |

### General / técnico
| Estado | Funcionalidad |
|--------|----------------|
| ✅ | Navegación por pestañas: Cargar inventario, Bienes, Valorización, Catálogo, Trazabilidad, Historial |
| ✅ | Indicador de usuario y rol (Admin / Colab) en cabecera |
| ✅ | Diseño responsive con Tailwind |
| ⏳ | Backend (API + base de datos) para datos e imágenes |
| ⏳ | Despliegue en entorno de producción |

---

## Detalle por áreas

### Autenticación y acceso
- **Qué hace:** Controla quién entra a la aplicación. El usuario introduce su email y elige rol (Administrador o Colaborador); no hay contraseña ni validación contra un servidor. La sesión se guarda en `localStorage` y se restaura al volver a abrir la app.
- **Dónde está:** Página de login (`/login`), `AuthContext` (estado global de usuario), y redirección de rutas cuando no hay sesión. En la cabecera se muestra el email y el rol (Admin/Colab) y el botón “Cerrar sesión”.
- **Detalle técnico:** Roles usados para restringir ciertas acciones (por ejemplo, carga/vaciado de inventario puede limitarse a administrador según implementación). No hay JWT ni API de login; todo es simulado en frontend.

### Carga de inventario
- **Qué hace:** Permite poblar o actualizar el inventario desde un archivo CSV. El usuario sube el archivo, ve una vista previa con el mapeo de columnas (código de inventario, nombre, tipo de bien, descripción, cantidad, valor en libros, estado de verificación, etc.), elige modo “actualización” (fusionar con lo existente) o “reemplazo” (borrar y cargar de nuevo), y ejecuta la carga. También puede vaciar todo el inventario (con confirmación).
- **Dónde está:** Ruta `/import` (ImportPage). Incluye el **Gestor de imágenes** en la misma página (pestañas Carga masiva / Gestión por producto).
- **Detalle técnico:** El CSV se parsea en el cliente (`parseCsvBienes`); los productos se guardan en el estado de React (InventoryContext) y, si está configurado, en `localStorage`. No hay validación fila a fila con mensajes de error por línea.

### Listado de bienes (Bienes)
- **Qué hace:** Muestra la tabla principal del inventario: nombre, código (SKU), tipo de bien, cantidad, valor en libros, estado de verificación, etc., con paginación. Desde aquí se puede añadir un ítem manualmente (modal) y abrir la ficha técnica de cualquier producto para ver o editar especificaciones, material, certificaciones e imágenes.
- **Dónde está:** Ruta `/` (ProductsPage), componente ProductList, modales AddProductModal y FichaTecnicaModal.
- **Detalle técnico:** Los datos vienen del mismo estado global (InventoryContext). La paginación y el total de ítems se calculan en el frontend. No hay búsqueda ni filtros por columna ni exportación a CSV/Excel.

### Valorización de activos
- **Qué hace:** Muestra una vista centrada en el valor: por cada producto, valor unitario (libros) y valor total (cantidad × valor unitario), más un total general de valorización del inventario. Misma lista paginada que en Bienes pero con foco en números.
- **Dónde está:** Ruta `/cost-earning` (CostEarningPage), componente CostEarningTable.
- **Detalle técnico:** Cálculos en cliente; no hay reportes ni gráficos ni exportación.

### Gestión de imágenes
- **Qué hace:** Permite asociar fotos a los productos de dos formas. (1) **Carga masiva:** el usuario arrastra varias imágenes o un archivo ZIP; el sistema extrae las imágenes del ZIP (vía JSZip en el navegador) y, por cada archivo, toma el nombre sin extensión como SKU y lo vincula al producto que coincida en el inventario. Muestra un resumen: cuántas se asociaron, cuántas no tenían SKU coincidente y cuántos productos siguen sin foto; además lista los archivos no asociados para que el usuario pueda renombrarlos. (2) **Gestión por producto:** tabla con una fila por producto (con línea divisoria entre filas), miniatura de la foto (clicable para lightbox), y botón “Subir” (cámara) para asignar una imagen a ese producto. Opción “Limpiar todo” para quitar todas las imágenes (con confirmación y registro en auditoría).
- **Dónde está:** Dentro de la página Cargar inventario (`/import`), componente GestorImagenes (pestañas “Carga masiva” y “Gestión por producto”). BulkImageUploader existe como componente alternativo/reutilizable.
- **Detalle técnico:** Las imágenes se guardan como URLs en memoria (`URL.createObjectURL`); no se suben a un servidor. Al recargar la página se pierden. La vinculación por SKU normaliza espacios y quita “.0” final del código para mejorar el emparejamiento.

### Catálogo
- **Qué hace:** Muestra el inventario en formato catálogo: grid de tarjetas (ficha técnica resumida) con imagen, nombre y datos principales. Al hacer clic en una tarjeta se abre un modal con la ficha técnica completa: especificaciones, características, composición, material, formato, origen, tamaño, certificaciones e imágenes referenciales.
- **Dónde está:** Ruta `/catalogo` (CatalogoPage), componentes FichaTecnicaCard y FichaTecnicaModal.
- **Detalle técnico:** Misma fuente de datos que Bienes; paginación en grid (por ejemplo 6 ítems por página). No hay filtros por tipo de bien ni búsqueda en catálogo.

### Trazabilidad / movimientos
- **Qué hace:** Registra movimientos de stock (entradas, salidas, devoluciones, etc.) con tipo de movimiento, cantidad, responsable, motivo y fecha/hora. Permite dar de alta un ítem nuevo por devolución (SKU que aún no existe). El usuario puede consultar el historial de movimientos (por producto o global) con fechas en zona Chile.
- **Dónde está:** Ruta `/trazabilidad` (TrazabilidadPage). Tipos de movimiento y etiquetas definidos en `types/movement`.
- **Detalle técnico:** Movimientos y productos viven en estado (InventoryContext) y, si se usa, en `localStorage`. No hay API ni base de datos; al cambiar de dispositivo o borrar datos locales se pierde el historial.

### Historial de actividad (auditoría)
- **Qué hace:** Lista los eventos de auditoría registrados por el sistema (cambios de imágenes, ajustes de stock, limpieza de imágenes, etc.) con timestamp, tipo de acción, SKU afectado, detalle y valores anteriores/nuevos cuando aplica. Para eventos marcados como reversibles, el usuario puede ejecutar “Revertir” y el sistema intenta deshacer la acción (por ejemplo restaurar imágenes o cantidad).
- **Dónde está:** Ruta `/actividad` (ActivityLogPage). Los eventos se generan desde InventoryContext y otros componentes (por ejemplo GestorImagenes al cargar o limpiar imágenes).
- **Detalle técnico:** Lista ordenada por fecha (más reciente primero). No hay persistencia en servidor ni filtros por tipo de evento o por SKU.

### General / técnico
- **Qué hace:** La aplicación es una SPA con navegación por enlaces (Cargar inventario, Bienes, Valorización, Catálogo, Trazabilidad, Historial de actividad). La cabecera muestra el título del sistema, los enlaces y el usuario con rol (Admin/Colab) y botón de cerrar sesión. Estilos con Tailwind para un diseño coherente y adaptable.
- **Dónde está:** App.jsx (rutas y navegación), layout y estilos globales. No hay backend desplegado; todo el estado es cliente (React + contexto + opcional localStorage).

---

## Resumen para demo / usuario final

**Qué puede hacer hoy un usuario:**

1. **Entrar al sistema**  
   Inicia sesión con su email y rol (Administrador o Colaborador). La sesión se mantiene hasta que cierre sesión.

2. **Cargar el inventario**  
   En *Cargar inventario* sube un CSV con los bienes (código, nombre, tipo, cantidad, valor, etc.). Puede ver una vista previa, elegir si actualizar o reemplazar, y vaciar el inventario si lo necesita.

3. **Ver y gestionar bienes**  
   En *Bienes* ve la lista paginada de productos, puede añadir ítems manualmente y abrir la ficha técnica de cada uno para ver o editar detalles.

4. **Ver valorización**  
   En *Valorización* consulta el valor en libros por producto y el total del inventario.

5. **Asignar fotos a los productos**  
   En *Cargar inventario*, en la sección del Gestor de imágenes:
   - **Carga masiva:** arrastra varias imágenes (o un **ZIP** con muchas). Si cada archivo se llama como el SKU del producto (ej. `8000008164911.jpg`), el sistema las asocia solas. Ve un resumen de cuántas se vincularon y cuáles no coincidieron.
   - **Por producto:** en la pestaña “Gestión por producto” ve una tabla con una línea entre cada producto; puede subir la foto con el botón de cámara y hacer clic en la miniatura para ampliarla.

6. **Consultar el catálogo**  
   En *Catálogo* ve las fichas técnicas en tarjetas; al hacer clic en una abre el detalle completo (especificaciones, material, certificaciones, fotos).

7. **Registrar movimientos**  
   En *Trazabilidad* registra entradas, salidas y devoluciones, y consulta el historial de movimientos.

8. **Revisar y revertir acciones**  
   En *Historial de actividad* ve todas las acciones registradas (imágenes, ajustes, etc.) y puede revertir algunas cuando el sistema lo permita.

**Limitaciones actuales (importante para la demo):**  
Los datos y las imágenes viven en el navegador (memoria/localStorage). Si se recarga la página o se usa otro dispositivo, el inventario y las fotos cargadas no se conservan a menos que se implemente un backend y persistencia real.

---

## Próximos pasos

Prioridad sugerida para seguir evolucionando el sistema:

1. **Backend y persistencia**
   - Implementar API REST (por ejemplo con Node/Express o similar) y base de datos (PostgreSQL u otra) según la guía en `docs/BACKEND_GUIDELINE.md`.
   - Migrar productos, movimientos y eventos de auditoría desde estado/localStorage al backend para que los datos persistan y sean compartidos entre dispositivos y usuarios.

2. **Imágenes en servidor**
   - Subir las imágenes a almacenamiento (servidor propio, S3 o similar) y guardar en base de datos solo las URLs o rutas. Así las fotos cargadas desde el Gestor de imágenes (incluido ZIP) sobreviven a recargas y distintos navegadores.

3. **Autenticación real**
   - Sustituir el login simulado por autenticación contra el backend (por ejemplo JWT o sesiones). Añadir recuperación de contraseña si se requiere.

4. **Validación y calidad de datos**
   - En la carga CSV: validación por fila con mensajes claros (filas omitidas, errores de formato, SKU duplicados) para que el usuario corrija el archivo antes de confirmar.

5. **Búsqueda y filtros**
   - En Bienes: búsqueda por nombre o SKU y filtros (por tipo de bien, estado de verificación). En Catálogo: filtros por tipo y búsqueda. En Historial de actividad: filtro por tipo de evento y por SKU.

6. **Exportación y reportes**
   - Exportar lista de bienes o valorización a CSV/Excel. Opcional: gráficos o reportes de valorización en el tiempo.

7. **Permisos por rol**
   - Dejar bien definido qué puede hacer solo el Administrador (vaciar inventario, cargar CSV, revertir auditoría, etc.) y qué puede hacer el Colaborador (consultar, registrar movimientos, subir fotos, etc.) y aplicar las restricciones en frontend y backend.

8. **Despliegue**
   - Preparar build de producción (Vite), configurar variables de entorno y desplegar frontend y, cuando exista, backend en un entorno estable (Vercel, Netlify, VPS, etc.).

---

*Documento generado a partir del estado del código. Actualizar según avance el proyecto.*
