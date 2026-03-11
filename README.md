# Sistema de Inventario de Bienes – SLEP Litoral

Aplicación web para la **actualización de inventario de bienes muebles e inmuebles** en el marco del traspaso **SLEP Litoral** (Ley N° 24.040), en respuesta al llamado de la **Municipalidad de Algarrobo**.

**Referencia:** [Mercado Público – Ficha 2687-34-COT26](https://buscador.mercadopublico.cl/ficha?code=2687-34-COT26)

## Alcance del proyecto (resumen del llamado)

- Inventario de **9.000 bienes de uso** al **28.02.2026**
- Levantamiento mediante **inventario ciego** con **verificación en terreno** a partir del inventario teórico
- **Codificación y rotulación** de bienes muebles
- **Conciliación contable** y **valorización de activos**
- Toma de inventario en **marzo**; entrega de **informe hasta el 06 de abril de 2026**

Requisitos detallados y mapeo al sistema: **[docs/REQUIREMENTS_ALGARROBO.md](docs/REQUIREMENTS_ALGARROBO.md)**.

## Stack

- **Frontend:** React 18 + Vite, React Router
- **Estado:** Context (auth), hooks (datos)
- **Estilos:** CSS global (BEM)

## Cómo ejecutar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura principal

- **Bienes:** listado en tabla (nombre, código, tipo, cantidad, valorización, estado de verificación)
- **Valorización:** costo y valor en libros por bien
- **Iniciar sesión:** autenticación (MVP simulada)

## Documentación

- [Requisitos Municipalidad de Algarrobo / SLEP Litoral](docs/REQUIREMENTS_ALGARROBO.md)
- [Guía de desarrollo backend](docs/BACKEND_GUIDELINE.md)

---

*React + Vite – Template base con ESLint. Ver [Vite](https://vite.dev) y [React](https://react.dev) para más información.*
