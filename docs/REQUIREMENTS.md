# Requisitos del proyecto 

Sistema de inventario alineado al llamado de la **Municipalidad de Algarrobo** (Traspaso SLEP Litoral, Ley N° 24.040).

**Referencia Mercado Público:** [Ficha 2687-34-COT26](https://buscador.mercadopublico.cl/ficha?code=2687-34-COT26)

---

## 1. Alcance del llamado (resumen)

| Requisito | Descripción |
|-----------|-------------|
| **Objeto** | Inventario de bienes muebles e inmuebles – actualización de inventario en el marco del traspaso SLEP Litoral (Ley N° 24.040). |
| **Volumen** | Toma de inventario para **9.000 bienes de uso** al **28.02.2026**. |
| **Metodología** | Levantamiento e identificación mediante **inventario ciego** con **verificación en terreno**, en base a **inventario teórico**, para actualizar inventario. |
| **Entregables** | **Codificación y rotulación** de bienes muebles; **conciliación contable** y **valorización de activos**. |
| **Plazos** | Toma de inventario en **marzo**; entrega de **informe hasta el 06 de abril de 2026**. |

---

## 2. Mapeo requisito → sistema

### 2.1 Inventario de bienes muebles e inmuebles

- **Requisito:** Diferenciar bienes muebles y bienes inmuebles.
- **En el sistema:** Campo **tipo de bien** (`mueble` / `inmueble`) en cada ítem. Filtros y reportes por tipo.

### 2.2 Inventario teórico vs verificación en terreno

- **Requisito:** Inventario ciego con verificación en terreno a partir del inventario teórico.
- **En el sistema:** Estado de verificación por ítem, por ejemplo:
  - `teorico` – solo en inventario teórico
  - `verificado_terreno` – verificado en terreno
  - `no_encontrado` – no encontrado en terreno (para conciliación)

### 2.3 Codificación y rotulación

- **Requisito:** Codificación y rotulación de bienes muebles.
- **En el sistema:** Campo **código de inventario** (codificación única por bien) y opcional **código de rotulación** o etiqueta para impresión/lectura en terreno.

### 2.4 Conciliación contable

- **Requisito:** Conciliación entre inventario físico (terreno) y registros contables.
- **En el sistema:** Estado de conciliación por ítem (`conciliado` / `pendiente` / `diferencias`) y módulo o reporte de conciliación (listado de diferencias, ajustes).

### 2.5 Valorización de activos

- **Requisito:** Valorización de los activos inventariados.
- **En el sistema:** Campo **valor en libros** (o valor contable) por bien; reportes de valorización total por tipo, por unidad, etc. El módulo actual "Costo y Ganancia" puede extenderse o renombrarse a **Valorización** para este contexto.

### 2.6 Fechas y plazos

- **Requisito:** Bienes de uso al 28.02.2026; toma en marzo; informe hasta 06.04.2026.
- **En el sistema:** Fecha de corte de inventario (ej. 28.02.2026), fecha de verificación por ítem, y generación de **informe** exportable (Excel/PDF) con resumen y detalle para entrega antes del 06.04.2026.

### 2.7 Volumen (9.000 bienes)

- **Requisito:** Sistema debe soportar orden de magnitud de 9.000 ítems.
- **En el sistema:** Paginación, búsqueda y filtros en listados; backend con índices y consultas eficientes; opcional carga masiva (Excel/CSV).

---

## 3. Modelo de datos sugerido (bienes)

Campos mínimos recomendados para cada **bien**:

| Campo | Tipo | Uso |
|-------|------|-----|
| id | UUID / SERIAL | Identificador único |
| tipo_bien | enum: mueble, inmueble | Clasificación del bien |
| codigo_inventario | string, único | Codificación (y base para rotulación) |
| nombre | string | Descripción del bien |
| descripcion | text | Detalle adicional |
| cantidad | integer | Unidades (normalmente 1 por ítem en bienes de uso) |
| valor_libros | decimal | Valorización / valor en libros |
| estado_verificacion | enum: teorico, verificado_terreno, no_encontrado | Inventario ciego / terreno |
| estado_conciliacion | enum: pendiente, conciliado, diferencias | Conciliación contable |
| fecha_inventario_corte | date | Fecha de corte (ej. 28.02.2026) |
| fecha_verificacion | date, nullable | Fecha de verificación en terreno |
| ubicacion | string, opcional | Oficina, dependencia, dirección (inmuebles) |
| created_at / updated_at | timestamp | Auditoría |

Para **valorización y conciliación** se pueden reutilizar o extender tablas de "costo/valor" y de movimientos o ajustes según necesidad contable.

---

## 4. Módulos del sistema (alineados al llamado)

1. **Bienes (listado y detalle)**  
   Alta, edición y consulta de bienes con tipo, código, nombre, descripción, cantidad, valor en libros, estado de verificación y conciliación.

2. **Valorización**  
   Reporte de valorización por bien y totales (por tipo, por dependencia, etc.) con valor en libros.

3. **Conciliación**  
   Vista de ítems pendientes de conciliar, con diferencias y estados; opcional registro de ajustes.

4. **Informe para entrega (06.04.2026)**  
   Exportación (Excel/PDF) con resumen y detalle del inventario, valorización y conciliación, con fecha de corte e identificación del proyecto (SLEP Litoral / Municipalidad de Algarrobo).

5. **Usuarios y acceso**  
   Login y roles para diferenciar quien carga inventario teórico, quien registra verificación en terreno y quien aprueba conciliación (según necesidad del mandante).

---

## 5. Web scraping / información adicional

La URL de Mercado Público devuelve **403** desde entornos automatizados, por lo que no se pudo obtener más detalle por scraping. Se recomienda:

- Revisar la ficha manualmente en [buscador.mercadopublico.cl](https://buscador.mercadopublico.cl/ficha?code=2687-34-COT26) para pliegos, anexos y formatos de informe.
- Solicitar bases o anexos al organismo (Municipalidad de Algarrobo / SLEP Litoral) para alinear codificación, rotulación y formato del informe al 06.04.2026.

---

## 6. Checklist de cumplimiento (referencia)

- [ ] Catálogo de bienes con tipo **mueble** / **inmueble**.
- [ ] Codificación única por bien y soporte a rotulación.
- [ ] Estados: inventario teórico vs verificado en terreno vs no encontrado.
- [ ] Módulo de conciliación contable (estados y listados).
- [ ] Valorización (valor en libros) y reportes de valorización.
- [ ] Fecha de corte 28.02.2026 y plazos de verificación (marzo).
- [ ] Generación de informe para entrega hasta 06.04.2026.
- [ ] Diseño que soporte ~9.000 bienes (paginación, filtros, rendimiento).

Este documento sirve como guía para ajustar el proyecto al inventario de la Municipalidad de Algarrobo (SLEP Litoral) y puede actualizarse con nuevos requisitos extraídos de pliegos o anexos.
