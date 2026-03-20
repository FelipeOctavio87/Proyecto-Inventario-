# Autenticación y permisos (estado actual)

## Resumen

- La sesión y el **rol** (`administrador` | `colaborador`) se guardan en **`localStorage`** (`inventory_auth`).
- **No hay backend** que valide identidad ni rol: cualquier persona con acceso al navegador puede inspeccionar o modificar ese valor.
- La app es adecuada como **demo / intranet de confianza**, no como control de acceso fuerte.

## Matriz deseada (UX)

La fuente de verdad en código es `src/auth/permissions.js` (`PERMISSIONS`, `canPerform`).

| Permiso | Administrador | Colaborador |
|--------|:-------------:|:-------------:|
| Importación CSV masiva / Cargar inventario (completo) | Sí | No |
| Vaciar inventario | Sí | No |
| Gestor de imágenes por SKU (página Cargar inventario) | Sí | Sí (MVP) |
| Alta de bien individual | Sí | Sí |
| Cambiar estado de verificación (tabla Bienes) | Sí | Sí |
| Ver Bienes, Valorización, Catálogo, Trazabilidad, Historial | Sí | Sí |
| Registrar movimientos | Sí | Sí |

En producción puedes retirar `BULK_REFERENCE_IMAGES` del rol colaborador en `permissions.js` si quieres restringir el gestor masivo solo a administradores.

## Integración

- `AuthContext` expone `can(permission)` basado en `user.role`.
- Las pantallas deben usar `can(PERMISSIONS.…)` para mantener la matriz centralizada.

## Próximo paso recomendado (producción)

- Autenticación con **servidor** (sesión o JWT firmado).
- Roles y permisos resueltos **solo en backend**; el cliente solo muestra/oculta UX, no aplica seguridad real.
