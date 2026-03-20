/**
 * Persistencia local (IndexedDB) — spike para sobrevivir recargas sin backend.
 * Un solo registro clave-valor con snapshot de inventario.
 */

const DB_NAME = 'proyecto-inventario-v1'
const STORE = 'snapshots'
const KEY = 'inventory'

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })

/**
 * @returns {Promise<{ products: unknown[], movements: unknown[], auditEvents: unknown[] } | null>}
 */
export async function loadPersistedInventory() {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const g = store.get(KEY)
      g.onerror = () => reject(g.error)
      g.onsuccess = () => {
        db.close()
        resolve(g.result ?? null)
      }
    })
  } catch {
    return null
  }
}

/**
 * @param {{ products: unknown[], movements: unknown[], auditEvents: unknown[] }} snapshot
 */
export async function savePersistedInventory(snapshot) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.onerror = () => reject(tx.error)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      const store = tx.objectStore(STORE)
      const p = store.put(snapshot, KEY)
      p.onerror = () => reject(p.error)
    })
  } catch {
    /* ignorar cuotas / modo privado */
  }
}
