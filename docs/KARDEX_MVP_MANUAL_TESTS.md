# Checklist manual — MVP kardex (import CSV)

Usar como smoke test tras cambios en importación o `InventoryContext`.

## Prerrequisitos

- Usuario administrador (Cargar inventario).
- CSV de prueba con SKUs que existan en el inventario y, opcionalmente, un SKU nuevo.

## Casos

### 1. Import actualización — cambio de cantidad (2+ SKUs)

1. Modo **Actualización masiva**.
2. CSV con al menos 2 filas de SKUs ya existentes y **cantidades distintas** a las actuales.
3. Confirmar carga.

**Esperado:** En **Trazabilidad → Historial de movimientos**, una línea por SKU con cantidad cambiada; tipo *Importación CSV (actualización)*; columna *Stock (antes → después)* coherente; mismo `correlationId` en los objetos de movimiento (inspección opcional en devtools).

### 2. Import actualización — sin cambio de stock

1. CSV que **no modifique** las cantidades respecto al inventario actual (resto de columnas puede variar o no).

**Esperado:** **No** aparecen nuevas filas de movimiento por cantidad (solo evento `IMPORT_COMMIT` en Historial de actividad).

### 3. Sobrescritura total (inventario inicial)

1. Tener movimientos previos en Trazabilidad.
2. Modo **Inventario inicial** y CSV válido.
3. Confirmar.

**Esperado:** Lista de movimientos en Trazabilidad **vacía**. En **Historial de actividad**: evento de **reinicio de trazabilidad operativa (kardex)** (`MOVEMENT_LEDGER_RESET`) y `IMPORT_COMMIT`.

### 4. Correlación del lote

Tras un import en actualización con varias líneas que cambien stock:

**Esperado:** Todos los movimientos generados en esa carga comparten el mismo `correlationId`.

### 5. Movimientos manuales (Trazabilidad)

Registrar un movimiento desde el formulario de Trazabilidad (sin CSV).

**Esperado:** Nueva fila en el historial de movimientos; columna *antes → después* usa derivación `quantityAfter - quantityDelta` si no hay `quantityBefore`.

### 6. Persistencia

Tras el caso 1 o 5, **recargar** la aplicación (F5).

**Esperado:** Los movimientos siguen listados (IndexedDB).
