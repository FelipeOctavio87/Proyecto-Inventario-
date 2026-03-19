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

  const data = (await res.json()) as Partial<BarcodeLookupResponse>
  if (!data || typeof data.sku !== 'string' || typeof data.nombre !== 'string') {
    throw new Error('Respuesta del servidor inválida.')
  }

  return {
    sku: data.sku,
    nombre: data.nombre,
    stockActual: Number(data.stockActual ?? 0),
    imagenUrl: data.imagenUrl ?? null,
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
      if (body && typeof body.message === 'string') msg = body.message
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
