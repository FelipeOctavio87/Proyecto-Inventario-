/**
 * Matriz de permisos (solo cliente).
 *
 * El rol efectivo hoy viene de `localStorage` vía AuthContext: cualquier usuario puede alterar
 * estos datos en el navegador. Esta matriz sirve para UX coherente y documentación del modelo
 * deseado; **no** sustituye autenticación/autorización en servidor.
 *
 * @see docs/SECURITY_AUTH.md
 */

/** @typedef {'administrador' | 'colaborador' | null | undefined} AppRole */

export const PERMISSIONS = {
  /** Importación masiva CSV y políticas asociadas (página Cargar inventario — modo admin). */
  BULK_CSV_IMPORT: 'bulk_csv_import',
  /** Vaciar inventario y operaciones destructivas de ese nivel. */
  INVENTORY_PURGE: 'inventory_purge',
  /** Gestor de imágenes masivo en la misma zona que CSV (solo admin en la UI actual). */
  BULK_REFERENCE_IMAGES: 'bulk_reference_images',
  /** Alta de bienes uno a uno (Bienes). */
  ADD_SINGLE_PRODUCT: 'add_single_product',
  /** Cambio de estado de verificación desde la tabla de Bienes. */
  UPDATE_VERIFICATION_STATUS: 'update_verification_status',
  /** Navegación y lectura de inventario principal. */
  VIEW_INVENTORY: 'view_inventory',
  VIEW_VALORIZATION: 'view_valorization',
  VIEW_CATALOGO: 'view_catalogo',
  /** Registrar movimientos en Trazabilidad. */
  REGISTER_MOVEMENTS: 'register_movements',
  VIEW_ACTIVITY_LOG: 'view_activity_log',
}

const COLLABORATOR = new Set([
  PERMISSIONS.ADD_SINGLE_PRODUCT,
  PERMISSIONS.UPDATE_VERIFICATION_STATUS,
  PERMISSIONS.VIEW_INVENTORY,
  PERMISSIONS.VIEW_VALORIZATION,
  PERMISSIONS.VIEW_CATALOGO,
  PERMISSIONS.REGISTER_MOVEMENTS,
  PERMISSIONS.VIEW_ACTIVITY_LOG,
  /** Gestor por SKU en la página Cargar inventario (MVP: también disponible para colaborador). */
  PERMISSIONS.BULK_REFERENCE_IMAGES,
])

const ADMIN = new Set([
  ...COLLABORATOR,
  PERMISSIONS.BULK_CSV_IMPORT,
  PERMISSIONS.INVENTORY_PURGE,
  PERMISSIONS.BULK_REFERENCE_IMAGES,
])

const BY_ROLE = {
  administrador: ADMIN,
  colaborador: COLLABORATOR,
}

/**
 * @param {AppRole} role
 * @param {string} permission - Una clave de {@link PERMISSIONS}
 * @returns {boolean}
 */
export function canPerform(role, permission) {
  if (!role || !permission) return false
  const set = BY_ROLE[role]
  return !!set && set.has(permission)
}

/** Lista legible para documentación o depuración. */
export function listPermissionsForRole(role) {
  if (!role || !BY_ROLE[role]) return []
  return [...BY_ROLE[role]]
}
