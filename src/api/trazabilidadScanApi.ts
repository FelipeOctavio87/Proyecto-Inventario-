/** Respuesta GET /api/barcodes/{barcode} */
export type BarcodeLookupResponse = {
  sku: string
  nombre: string
  stockActual: number
  imagenUrl: string | null
}

/** Payload POST /api/trazabilidad/ajuste */
export type AjustePorEscaneoPayload = {
  sku: string
  barcode: string
  motivo: string
  retail: string | null
  cantidad: number
  tipo: 'entrada' | 'salida'
  funcionario: string
  dispositivo: string
  fecha: string
}

export function getApiBaseUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  return base
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}

export async function fetchProductByBarcode(
  barcode: string,
  signal?: AbortSignal
): Promise<BarcodeLookupResponse> {
  const url = buildUrl(`/api/barcodes/${encodeURIComponent(barcode)}`)
  const res = await fetch(url, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
  })

  if (res.status === 404) {
    throw new Error('Código de barras no encontrado.')
  }
  if (!res.ok) {
    throw new Error(`Error al consultar el código (${res.status}).`)
  }

  const data = (await res.json()) as Record<string, unknown> | null
  if (!data || typeof data !== 'object') {
    throw new Error('Respuesta del servidor inválida.')
  }

  // Soporta variaciones típicas del backend (por si los campos vienen con nombres alternativos).
  // Contrato esperado (según tu especificación):
  // { sku, nombre, stockActual, imagenUrl }
  const sku =
    (typeof data.sku === 'string' ? data.sku : undefined) ??
    (typeof data.SKU === 'string' ? data.SKU : undefined) ??
    (typeof data.codigoInventario === 'string' ? data.codigoInventario : undefined)

  const nombre =
    (typeof data.nombre === 'string' ? data.nombre : undefined) ??
    (typeof data.name === 'string' ? data.name : undefined) ??
    (typeof data.nombreProducto === 'string' ? data.nombreProducto : undefined)

  const stockRaw =
    data.stockActual ??
    data.stock ??
    data.stock_actual ??
    data.quantity ??
    data.stockDisponible

  const stockActual = Number(stockRaw ?? 0)

  const imagenUrlRaw =
    data.imagenUrl ??
    data.imagenURL ??
    data.imagen_url ??
    data.imageUrl ??
    data.image_url ??
    data.imagen

  const imagenUrl =
    typeof imagenUrlRaw === 'string' && imagenUrlRaw.trim().length > 0 ? imagenUrlRaw : null

  if (!sku || !nombre) {
    throw new Error('Respuesta del servidor inválida (falta sku o nombre).')
  }

  return {
    sku,
    nombre,
    stockActual: Number.isFinite(stockActual) ? stockActual : 0,
    imagenUrl,
  }
}

export async function postAjustePorEscaneo(
  payload: AjustePorEscaneoPayload,
  signal?: AbortSignal
): Promise<void> {
  const url = buildUrl('/api/trazabilidad/ajuste')
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    let msg = `No se pudo registrar el ajuste (${res.status}).`
    try {
      const body = await res.json()
      if (body && typeof body === 'object') {
        const maybeMessage =
          typeof (body as any).message === 'string'
            ? (body as any).message
            : typeof (body as any).error === 'string'
              ? (body as any).error
              : typeof (body as any).detail === 'string'
                ? (body as any).detail
                : null
        if (maybeMessage) msg = maybeMessage
      }
    } catch {
      try {
        const t = await res.text()
        if (t) msg = t.slice(0, 200)
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg)
  }
}
