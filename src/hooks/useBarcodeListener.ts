import { useCallback, useRef, type KeyboardEvent } from 'react'

export type BarcodeListenerHandlers = {
  /** Se invoca cuando el lector termina la lectura (Enter o Tab). */
  onBarcode: (code: string) => void
}

/**
 * Captura entrada de pistola lectora (simula teclado): caracteres en un input y cierre con Enter o Tab.
 * Usar con un input visible u oculto enfocado en bodega.
 */
export function useBarcodeListener({ onBarcode }: BarcodeListenerHandlers) {
  const inputRef = useRef<HTMLInputElement>(null)

  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' && e.key !== 'Tab') return

      const el = e.currentTarget
      const raw = el.value
      const code = raw.trim()
      el.value = ''

      if (code) {
        console.log('[useBarcodeListener] escaneo detectado:', code)
        onBarcode(code)
      }

      e.preventDefault()
      // Mantener foco para siguiente lectura
      requestAnimationFrame(() => el.focus())
    },
    [onBarcode]
  )

  return {
    inputRef,
    onKeyDown,
    focusInput,
  }
}
