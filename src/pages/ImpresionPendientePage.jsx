import { useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import PrintableLabel from '../components/PrintableLabel'

const unitKey = (u) => String(u?.id_unidad ?? u?.id ?? '').trim()

const isPendingUnit = (u) => {
  const estado = String(u?.estado ?? u?.status ?? '').trim().toLowerCase()
  const hasDisponible = estado === 'disponible' || (estado.includes('disponible') && estado.includes('inventario inicial'))
  return hasDisponible && u?.etiqueta_impresa !== true
}

export default function ImpresionPendientePage() {
  const { user } = useAuth()
  const { unitItems, markUnitsPrinted } = useInventory()

  const pendingUnits = useMemo(() => {
    const list = Array.isArray(unitItems) ? unitItems : []
    return list.filter(isPendingUnit)
  }, [unitItems])

  const pendingKeys = useMemo(() => pendingUnits.map(unitKey).filter(Boolean), [pendingUnits])
  const pendingCount = pendingUnits.length

  const [selectedKeys, setSelectedKeys] = useState([])
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const selectedCount = selectedKeys.length

  const unitsByKey = useMemo(() => {
    const map = new Map()
    pendingUnits.forEach((u) => {
      const k = unitKey(u)
      if (!k) return
      map.set(k, u)
    })
    return map
  }, [pendingUnits])

  const selectedUnitsForPrint = useMemo(() => {
    return selectedKeys.map((k) => unitsByKey.get(k)).filter(Boolean)
  }, [selectedKeys, unitsByKey])

  const printRef = useRef(null)
  const [feedback, setFeedback] = useState('')

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'impresion-pendiente-datamatrix',
    onAfterPrint: () => {
      if (selectedKeys.length === 0) return
      markUnitsPrinted(selectedKeys, { actorEmail: user?.email })
      setSelectedKeys([])
      setFeedback('Impresión masiva registrada: unidades marcadas como impresas.')
      setTimeout(() => setFeedback(''), 3500)
    },
  })

  const toggleSelected = (key, checked) => {
    if (!key) return
    setSelectedKeys((prev) => {
      const has = prev.includes(key)
      if (checked && !has) return [...prev, key]
      if (!checked && has) return prev.filter((x) => x !== key)
      return prev
    })
  }

  const allSelected = pendingCount > 0 && selectedCount === pendingCount

  return (
    <div className="page ingreso-page">
      <section className="import">
        <h2 className="import__title">Impresión Pendiente</h2>
        <p className="import__subtitle">
          Unidades en <code>inventory_units</code> con estado disponible e impresión pendiente.
        </p>

        <div className="import__block import__block--bienes-panel">
          <h3 className="import__block-title">Pendientes ({pendingCount})</h3>

          <div className="import__collab-actions" style={{ alignItems: 'center' }}>
            <button
              type="button"
              className="import__btn import__btn--secondary"
              onClick={() => setSelectedKeys(pendingKeys)}
              disabled={pendingCount === 0 || allSelected}
            >
              Seleccionar Todo
            </button>
            <button
              type="button"
              className="import__btn import__btn--secondary"
              onClick={() => setSelectedKeys([])}
              disabled={selectedCount === 0}
            >
              Limpiar selección
            </button>

            <button
              type="button"
              className="import__btn"
              onClick={() => {
                if (selectedKeys.length === 0) return
                const ok = window.confirm(
                  `¿Confirmar impresión de ${selectedKeys.length} etiqueta(s)?`
                )
                if (!ok) return
                handlePrint()
              }}
              disabled={selectedCount === 0}
            >
              Imprimir ({selectedCount})
            </button>
          </div>

          {feedback && (
            <p className="import__validation-msg import__validation-msg--warn" style={{ marginTop: '0.75rem' }}>
              {feedback}
            </p>
          )}

          {pendingCount === 0 ? (
            <p className="import__hint">No hay etiquetas pendientes para imprimir.</p>
          ) : (
            <div className="import__preview-table-wrap" style={{ maxHeight: '56vh', overflow: 'auto', marginTop: '1rem' }}>
              <table className="product-table">
                <thead>
                  <tr>
                    <th style={{ width: '52px' }}>Sel.</th>
                    <th>ID unidad</th>
                    <th>Serial</th>
                    <th>SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUnits.map((u) => {
                    const key = unitKey(u)
                    return (
                      <tr key={key}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(key)}
                            onChange={(e) => toggleSelected(key, e.target.checked)}
                            aria-label={`Seleccionar ${u?.serial ?? ''}`}
                            style={{ width: 20, height: 20 }}
                          />
                        </td>
                        <td style={{ fontFamily: 'ui-monospace, monospace' }}>{u?.id_unidad ?? '—'}</td>
                        <td style={{ fontWeight: 700 }}>{u?.serial ?? '—'}</td>
                        <td>{u?.sku_maestro ?? u?.sku ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Print batch (solo se imprime lo seleccionado). */}
        <div style={{ position: 'absolute', left: '-99999px', top: 0 }}>
          <div ref={printRef}>
            <div className="labels-grid">
              {selectedUnitsForPrint.map((u) => (
                <PrintableLabel key={unitKey(u)} item={u} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

