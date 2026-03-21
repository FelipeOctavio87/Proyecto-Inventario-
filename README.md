# Sistema de Gestión de Inventario

Aplicación web para **gestionar el inventario de productos y bienes** de una empresa. Pensado para **empresas que aún no tienen un sistema** y quieren comenzar a implementar el control de sus existencias en bodega.

## Propósito

Crear un **sistema de gestión de inventario** que permita:

- Llevar el control de todos los bienes y productos en almacén
- Registrar entradas, salidas y movimientos de stock
- Valorizar activos y generar reportes
- Trazabilidad e historial de actividad

Ideal para empresas que necesitan **empezar a implementar** un control de inventario de forma ordenada.

## Stack

- **Frontend:** React 19 + Vite, React Router
- **Estado:** Context (auth, inventario), hooks
- **Estilos:** Tailwind CSS

## Cómo ejecutar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura principal

- **Bienes:** listado en tabla (nombre, código, tipo, cantidad, valorización, estado de verificación)
- **Cargar inventario:** importación desde CSV o pegado de datos
- **Valorización:** costo y valor en libros por producto
- **Catálogo:** ficha técnica y especificaciones
- **Trazabilidad:** movimientos de stock (entradas, salidas, internos)
- **Historial de actividad:** auditoría y reversión de cambios
- **Iniciar sesión:** autenticación (MVP simulada)

## Documentación

- [Requisitos](docs/REQUIREMENTS.md)
- [Guía de desarrollo backend](docs/BACKEND_GUIDELINE.md)
- [Autenticación y permisos (MVP cliente)](docs/SECURITY_AUTH.md)
- [Checklist manual MVP kardex (import CSV)](docs/KARDEX_MVP_MANUAL_TESTS.md)
- [Checklist Fase 2 kardex (ajuste manual ficha)](docs/KARDEX_FASE2_MANUAL_TESTS.md)

---

*React + Vite. Ver [Vite](https://vite.dev) y [React](https://react.dev) para más información.*
