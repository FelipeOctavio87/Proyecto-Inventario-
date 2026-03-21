# Checklist manual — Fase 2 kardex (Ajuste de Cantidad desde ficha)

## 1. Edición cantidad en ficha (escaneo correcto)

1. Abrir **Bienes** → **Ver ficha** de un producto con **barcode válido** (>3 caracteres, alfanumérico + guiones, ver `barcodeManualAdjust.js`) y cantidad conocida (ej. 5).
2. En **Ajuste de Cantidad**, nueva cantidad (ej. 8), **motivo**, escanear o pegar el **mismo** barcode que muestra la ficha (prueba case distinta o con espacios si quieres validar normalización).
3. **Confirmar ajuste**.

**Esperado:** Mensaje de éxito; en **Trazabilidad** línea tipo **Ajuste de Cantidad**; `type: ajuste_cantidad`, `source: manual_scan_ui`; `barcodeValidated: true`, `verificationMethod: 'barcode_scan'`, `barcodeVerifiedAt` presente; **no** debe guardarse el string escaneado en el movimiento. Columna *Stock (antes → después)* `5 → 8`. En **Historial de Actividad**: evento **Ajuste de Cantidad (ficha)** con mención a verificación por escaneo.

4. Repetir bajando cantidad (ej. 8 → 3) con escaneo válido.

**Esperado:** Delta negativo; `8 → 3` en la tabla.

## 2. Escaneo incorrecto

1. Cambiar cantidad y motivo; en el campo de escaneo ingresar un código **distinto** al barcode del bien.

**Esperado:** Error en ficha (*no coincide*); sin movimiento ni evento de auditoría de ajuste.

## 3. Producto sin barcode válido

1. Bien con `barcode` vacío, muy corto (≤3) o con caracteres no permitidos (si existe en datos de prueba).

**Esperado:** Aviso en bloque Ajuste de Cantidad; campos deshabilitados y botón **Confirmar ajuste** deshabilitado; **Guardar ubicación** u otros flujos de la ficha siguen disponibles.

## 4. Sin cambio de cantidad

1. Misma cantidad que en sistema; motivo y escaneo rellenos; **Confirmar ajuste**.

**Esperado:** Error (*La cantidad es la misma…*); **no** nuevo movimiento.

## 5. Motivo o escaneo vacío (con cantidad distinta)

1. Cantidad distinta, motivo vacío → error de motivo.
2. Cantidad distinta, motivo OK, escaneo vacío → error de escaneo obligatorio.

**Esperado:** Sin movimiento.

## 6. Cambio de otros campos sin cambiar cantidad

1. **Ubicación física**: cambiar bodega/detalle y **Guardar ubicación** sin tocar Ajuste de Cantidad.

**Esperado:** Ubicación guardada; **no** exige escaneo ni movimiento de kardex por cantidad.

## 7. Persistencia

Tras un ajuste válido, **recargar** la página.

**Esperado:** Cantidad actualizada; movimientos siguen en Trazabilidad (IndexedDB).

## 8. Trazabilidad (sin ficha)

Registrar un movimiento desde el **formulario de Trazabilidad** (entrada/salida).

**Esperado:** Nueva fila; `source: manual_trazabilidad`; distinto de `manual_scan_ui`.

## 9. Regresión Fase 1 (CSV)

**Actualización masiva** con cambio de cantidad en CSV.

**Esperado:** Movimientos con tipo *Importación CSV (actualización)*, `source: csv_import` y `correlationId` presente.

## 10. Historial de Actividad

Tras un ajuste válido desde ficha, revisar **Historial de Actividad**.

**Esperado:** Entrada **Ajuste de Cantidad (ficha)**; detalle con rango de uds. y motivo; metadata con verificación por barcode (sin valor escaneado completo).
