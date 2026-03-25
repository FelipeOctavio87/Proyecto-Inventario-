import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import {
  parseCsvBienes,
  getHeaderMapping,
  buildImportIssuesCsv,
  computeImportPlan,
} from '../utils/parseCsvBienes'
import GestorImagenes from '../components/GestorImagenes'

const MAP_LABELS = {
  codigoInventario: 'Código inventario',
  name: 'Nombre',
  tipoBien: 'Tipo de bien',
  barcode: 'Código de barras',
  description: 'Descripción',
  ubicacionFisica: 'Ubicación física (bodega)',
  detalleUbicacion: 'Detalle de ubicación',
  quantity: 'Cantidad',
  valorLibros: 'Valor en libros',
  price: 'Precio venta unitario',
  estadoVerificacion: 'Estado verificación',
}

const PREVIEW_ROWS = 8
const CONFIRM_PURGE_TEXT = 'BORRAR'

const ImportPage = () => {
  const { can, PERMISSIONS, user } = useAuth()
  const canBulkCsv = can(PERMISSIONS.BULK_CSV_IMPORT)
  const {
    addBienesFromImport,
    vaciarInventario,
    logAuditEvent,
    totalCount,
    totalUnidades,
    products,
    movements,
    auditEvents,
  } = useInventory()
  const navigate = useNavigate()

  const [file, setFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [mappingPreview, setMappingPreview] = useState([])
  const [loadMode, setLoadMode] = useState('actualizacion')
  const [result, setResult] = useState(null)
  const [showVaciarConfirm, setShowVaciarConfirm] = useState(false)
  const [vaciarPhrase, setVaciarPhrase] = useState('')
  const [vaciarLoading, setVaciarLoading] = useState(false)
  const [blockIfBlockingErrors, setBlockIfBlockingErrors] = useState(true)
  const [blockDuplicateSkuInCsv, setBlockDuplicateSkuInCsv] = useState(false)
  const fileInputRef = useRef(null)

  const hasPreview = mappingPreview.length > 0
  const csvToProcess = fileContent

  const parseOutcome = useMemo(() => {
    if (!csvToProcess.trim()) return null
    return parseCsvBienes(csvToProcess)
  }, [csvToProcess])

  const importPlan = useMemo(() => {
    if (!parseOutcome) return null
    return computeImportPlan(parseOutcome.valid, products, {
      overwrite: loadMode === 'inicial',
      blockDuplicateSkuInCsv,
    })
  }, [parseOutcome, products, loadMode, blockDuplicateSkuInCsv])

  const effectiveBlockingErrors = useMemo(() => {
    if (!parseOutcome || !importPlan) return parseOutcome?.blockingErrors ?? []
    return [...parseOutcome.blockingErrors, ...importPlan.csvDuplicateBlocking]
  }, [parseOutcome, importPlan])

  const combinedWarnings = useMemo(() => {
    if (!parseOutcome || !importPlan) return parseOutcome?.warnings ?? []
    return [...parseOutcome.warnings, ...importPlan.csvDuplicateWarnings]
  }, [parseOutcome, importPlan])

  const handleCancelLoad = () => {
    if (fileContent.trim() && file) {
      logAuditEvent({
        usuario: user?.email || 'Sistema',
        accion: 'Importación CSV rechazada (cancelada antes de confirmar)',
        actionType: 'IMPORT_REJECTED',
        reversible: false,
        detalle: `El usuario canceló la carga con archivo seleccionado: ${file?.name ?? 'N/D'}.`,
        metadata: { fileName: file?.name ?? null },
      })
    }
    setFile(null)
    setFileContent('')
    setMappingPreview([])
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result ?? ''
      setFileContent(text)
      setMappingPreview(text.trim() ? getHeaderMapping(text) : [])
    }
    reader.readAsText(f, 'UTF-8')
  }

  const handleConfirmarCarga = () => {
    if (!csvToProcess.trim() || !parseOutcome || !importPlan) return
    if (blockIfBlockingErrors && effectiveBlockingErrors.length > 0) {
      return
    }
    if (importPlan.appliedRows.length === 0) return

    const correlationId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `imp-${Date.now()}`

    addBienesFromImport(importPlan.appliedRows, {
      overwrite: loadMode === 'inicial',
      actorEmail: user?.email,
      fileName: file?.name ?? null,
      correlationId,
    })

    setResult({
      imported: importPlan.appliedRows.length,
      createdCount: importPlan.stats.newCount,
      updatedCount: importPlan.stats.updateCount,
      duplicateRowsCollapsed:
        importPlan.stats.inputValidCount > importPlan.stats.appliedCount
          ? importPlan.stats.inputValidCount - importPlan.stats.appliedCount
          : 0,
      loadMode,
      blockingErrors: effectiveBlockingErrors,
      warnings: combinedWarnings,
      totalDataRows: parseOutcome.totalDataRows,
      fileName: file?.name ?? null,
      correlationId,
    })
    setFile(null)
    setFileContent('')
    setMappingPreview([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const downloadIssuesReport = () => {
    if (!parseOutcome) return
    const csv = buildImportIssuesCsv(effectiveBlockingErrors, combinedWarnings)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `import-incidencias-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadResultReport = () => {
    if (!result) return
    const csv = buildImportIssuesCsv(result.blockingErrors || [], result.warnings || [])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `import-resultado-incidencias.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const openVaciarModal = () => {
    setVaciarPhrase('')
    setShowVaciarConfirm(true)
  }

  const closeVaciarModal = () => {
    if (vaciarLoading) return
    setShowVaciarConfirm(false)
    setVaciarPhrase('')
  }

  const handleVaciarInventario = () => {
    if (!can(PERMISSIONS.INVENTORY_PURGE)) return
    if (vaciarPhrase.trim() !== CONFIRM_PURGE_TEXT) return
    setVaciarLoading(true)
    requestAnimationFrame(() => {
      try {
        vaciarInventario({
          actorEmail: user?.email,
          snapshot: {
            productCount: products.length,
            movementCount: movements.length,
            auditEventCount: auditEvents.length,
            totalUnidades,
          },
        })
      } finally {
        setVaciarLoading(false)
        setShowVaciarConfirm(false)
        setVaciarPhrase('')
      }
    })
  }

  const canConfirmLoad =
    parseOutcome &&
    importPlan &&
    importPlan.appliedRows.length > 0 &&
    (!blockIfBlockingErrors || effectiveBlockingErrors.length === 0)
  const isPurgeReady = vaciarPhrase.trim() === CONFIRM_PURGE_TEXT && !vaciarLoading

  if (!canBulkCsv) {
    return (
      <div className="page import-page">
        <section className="import">
          <h2 className="import__title">Cargar inventario</h2>
          <div className="import__collab-block" role="status">
            <p className="import__collab-text">
              Como <strong>Colaborador</strong> no puedes realizar cargas masivas de CSV ni vaciar el inventario.
            </p>
            <p className="import__collab-text">
              Tu interfaz permite:
            </p>
            <ul className="import__collab-list">
              <li><strong>Añadir ítems individuales</strong> desde la página de Bienes</li>
              <li><strong>Informar novedades</strong> y movimientos en Trazabilidad</li>
              <li><strong>Actualizar estados</strong> de bienes ya existentes en el listado de Bienes</li>
            </ul>
            <div className="import__collab-actions">
              <button type="button" className="import__btn" onClick={() => navigate('/')}>
                Ir a Bienes
              </button>
              <button type="button" className="import__btn import__btn--secondary" onClick={() => navigate('/trazabilidad')}>
                Ir a Trazabilidad
              </button>
            </div>
          </div>
          {can(PERMISSIONS.BULK_REFERENCE_IMAGES) && (
            <div className="import__block import__block--bienes-panel mt-6">
              <h3 className="import__block-title">Gestor de imágenes</h3>
              <GestorImagenes />
            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="page import-page">
      <section className="import">
        <h2 className="import__title">Cargar inventario</h2>
        <p className="import__subtitle">
          Sube un archivo CSV. Verás validación, vista previa e incidencias antes de confirmar la carga.
        </p>
        <div className="import__count-block">
          <p className="import__count">
            <strong>Total activos: {totalCount}</strong> (SKU únicos)
          </p>
          <p className="import__count import__count--secondary">
            Total stock: {totalUnidades.toLocaleString('es-CL')} unidades
          </p>
        </div>

        <div className="import__actions">
          <div className="import__block import__block--bienes-panel">
            <h3 className="import__block-title">1. Subir archivo CSV</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="import__file import__file--bienes"
            />
            {file && (
              <p className="import__file-name" role="status">
                Archivo seleccionado: <strong>{file.name}</strong>
              </p>
            )}
          </div>
        </div>

        {hasPreview && parseOutcome && (
          <>
            <div className="import__mapping import__format">
              <h4>Mapeo de columnas del CSV</h4>
              <p className="import__mapping-desc">
                Comparación columnas del CSV vs campos del sistema. <span className="import__mapping-ok">✓</span> columna reconocida; <span className="import__mapping-fail">✗</span> no reconocida (no se usa en la importación).
              </p>
              <div className="import__mapping-table-wrap">
                <table className="import__mapping-table" role="table">
                  <thead>
                    <tr>
                      <th>Columna en tu CSV</th>
                      <th>Mapea a</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingPreview.map((row, i) => (
                      <tr key={i}>
                        <td>{row.rawHeader || '—'}</td>
                        <td>{row.ok ? MAP_LABELS[row.mappedTo] ?? row.mappedTo : '—'}</td>
                        <td>
                          {row.ok ? (
                            <span className="import__mapping-ok" aria-label="Mapeado correctamente">✓</span>
                          ) : (
                            <span className="import__mapping-fail" aria-label="No mapeado">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="import__format-note">
                <strong>Campos que reconoce la app:</strong> código/SKU — columnas como{' '}
                <em>codigoInventario, SKU, código, referencia, ref, id producto, clave, nº parte</em>, etc.; nombre —{' '}
                <em>name, Producto, nombre</em>; quantity (o Unidades); valorLibros; tipoBien; description; barcode;
                ubicacionFisica; detalleUbicacion; estadoVerificacion; price. Si no detecta columna de código, asigna{' '}
                <strong>INV-</strong>
                + número de fila (revisa el mapeo ✓/✗ arriba).
              </p>
            </div>

            <div className="import__block import__block--validation">
              <h3 className="import__block-title">2. Validación y vista previa</h3>
              <div className="import__stats-grid">
                <div className="import__stat">
                  <span className="import__stat-label">Filas de datos</span>
                  <span className="import__stat-value">{parseOutcome.totalDataRows}</span>
                </div>
                <div className="import__stat import__stat--ok">
                  <span className="import__stat-label">Válidas (leídas)</span>
                  <span className="import__stat-value">{parseOutcome.valid.length}</span>
                </div>
                <div className="import__stat import__stat--ok">
                  <span className="import__stat-label">SKU únicos a aplicar</span>
                  <span className="import__stat-value">{importPlan?.stats.appliedCount ?? '—'}</span>
                </div>
                {loadMode === 'actualizacion' && importPlan && (
                  <>
                    <div className="import__stat import__stat--ok">
                      <span className="import__stat-label">Altas previstas (SKU nuevo)</span>
                      <span className="import__stat-value">{importPlan.stats.newCount}</span>
                    </div>
                    <div className="import__stat import__stat--ok">
                      <span className="import__stat-label">Actualizaciones previstas (SKU existente)</span>
                      <span className="import__stat-value">{importPlan.stats.updateCount}</span>
                    </div>
                  </>
                )}
                {importPlan && importPlan.stats.inputValidCount > importPlan.stats.appliedCount && (
                  <div className="import__stat import__stat--warn">
                    <span className="import__stat-label">Filas fusionadas (mismo SKU en CSV)</span>
                    <span className="import__stat-value">
                      {importPlan.stats.inputValidCount - importPlan.stats.appliedCount}
                    </span>
                  </div>
                )}
                <div className="import__stat import__stat--err">
                  <span className="import__stat-label">Errores bloqueantes (fila)</span>
                  <span className="import__stat-value">{effectiveBlockingErrors.length}</span>
                </div>
                <div className="import__stat import__stat--warn">
                  <span className="import__stat-label">Advertencias</span>
                  <span className="import__stat-value">{combinedWarnings.length}</span>
                </div>
              </div>

              <p className="import__format-note import__policy-note" role="note">
                <strong>Política CSV:</strong> si el mismo SKU aparece varias veces, por defecto se aplica la{' '}
                <strong>última fila</strong> de ese SKU. Puedes activar abajo el bloqueo para exigir SKUs únicos en el archivo.
                En <strong>Actualización masiva</strong>, cada SKU del CSV <strong>actualiza</strong> el bien existente o se da de{' '}
                <strong>alta</strong> si no estaba.
              </p>

              {effectiveBlockingErrors.length > 0 && (
                <p className="import__validation-msg import__validation-msg--error" role="alert">
                  Hay filas con errores bloqueantes. Puedes descargar el reporte o corregir el CSV.
                  {blockIfBlockingErrors && ' La carga está bloqueada hasta que no queden bloqueantes o desactives la opción abajo.'}
                </p>
              )}

              {combinedWarnings.length > 0 && effectiveBlockingErrors.length === 0 && (
                <p className="import__validation-msg import__validation-msg--warn" role="status">
                  Hay advertencias (p. ej. barcode con formato dudoso o SKU duplicado en el CSV); revisa el detalle. Las filas
                  válidas se importan con las reglas indicadas.
                </p>
              )}

              <label className="import__checkbox-label">
                <input
                  type="checkbox"
                  checked={blockIfBlockingErrors}
                  onChange={(e) => setBlockIfBlockingErrors(e.target.checked)}
                />
                No permitir confirmar si hay errores bloqueantes
              </label>

              <label className="import__checkbox-label">
                <input
                  type="checkbox"
                  checked={blockDuplicateSkuInCsv}
                  onChange={(e) => setBlockDuplicateSkuInCsv(e.target.checked)}
                />
                Bloquear carga si hay el mismo SKU repetido en el CSV (no se fusiona; debes corregir el archivo)
              </label>

              {(effectiveBlockingErrors.length > 0 || combinedWarnings.length > 0) && (
                <div className="import__report-actions">
                  <button type="button" className="import__btn import__btn--secondary" onClick={downloadIssuesReport}>
                    Descargar reporte de incidencias (CSV)
                  </button>
                </div>
              )}

              <h4 className="import__preview-title">
                Muestra de filas a aplicar (última fila por SKU; primeras{' '}
                {Math.min(PREVIEW_ROWS, importPlan?.appliedRows.length ?? 0)})
              </h4>
              {!importPlan || importPlan.appliedRows.length === 0 ? (
                <p className="import__preview-empty">No hay filas válidas para importar.</p>
              ) : (
                <div className="import__mapping-table-wrap">
                  <table className="import__mapping-table import__preview-table" role="table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Nombre</th>
                        <th>Cant.</th>
                        <th>Valor libros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPlan.appliedRows.slice(0, PREVIEW_ROWS).map((row, i) => (
                        <tr key={i}>
                          <td>{row.codigoInventario}</td>
                          <td>{row.name}</td>
                          <td>{row.quantity}</td>
                          <td>{row.valorLibros}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <details className="import__details-errors">
                <summary>Detalle por fila (bloqueantes y advertencias)</summary>
                <ul className="import__error-list">
                  {effectiveBlockingErrors.map((e, i) => (
                    <li key={`b-${i}`} className="import__error-item import__error-item--blocking">
                      <strong>Fila {e.row}</strong> [{e.code || '—'}]: {e.message}
                    </li>
                  ))}
                  {combinedWarnings.map((e, i) => (
                    <li key={`w-${i}`} className="import__error-item import__error-item--warn">
                      <strong>Fila {e.row}</strong> [{e.code || '—'}]: {e.message}
                    </li>
                  ))}
                  {effectiveBlockingErrors.length === 0 && combinedWarnings.length === 0 && (
                    <li className="import__error-item">Sin incidencias.</li>
                  )}
                </ul>
              </details>
            </div>

            <div className="import__block import__block--confirm">
              <h3 className="import__block-title">3. Tipo de carga</h3>
              <label className="import__radio-label">
                <input
                  type="radio"
                  name="loadMode"
                  checked={loadMode === 'inicial'}
                  onChange={() => setLoadMode('inicial')}
                />
                <span>Inventario Inicial</span> — Sobrescribe todo el inventario actual con los datos del CSV.
              </label>
              <label className="import__radio-label">
                <input
                  type="radio"
                  name="loadMode"
                  checked={loadMode === 'actualizacion'}
                  onChange={() => setLoadMode('actualizacion')}
                />
                <span>Actualización masiva</span> — Actualiza bienes existentes por SKU y crea los que falten (merge).
              </label>

              <div className="import__confirm-actions">
                <button
                  type="button"
                  className="import__btn"
                  onClick={handleConfirmarCarga}
                  disabled={!csvToProcess.trim() || !canConfirmLoad}
                >
                  Confirmar Carga
                </button>
                <button type="button" className="import__btn import__btn--secondary" onClick={handleCancelLoad}>
                  Cancelar carga
                </button>
              </div>
            </div>
          </>
        )}

        {can(PERMISSIONS.BULK_REFERENCE_IMAGES) && (
          <div className="import__block import__block--bienes-panel mt-6">
            <h3 className="import__block-title">Gestor de imágenes</h3>
            <GestorImagenes />
          </div>
        )}

        <div className="import__block import__block--vaciar mt-6">
          <h3 className="import__block-title">Vaciar inventario</h3>
          <p className="import__vaciar-desc">
            Restablece bienes al estado inicial de demostración y elimina movimientos en memoria. El{' '}
            <strong>historial de auditoría se conserva</strong> y se registra quién vació. Solo administrador.
          </p>
          <button
            type="button"
            className="import__btn import__btn--danger"
            onClick={openVaciarModal}
          >
            Vaciar inventario
          </button>
        </div>

        {showVaciarConfirm && (
          <div className="import__modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vaciar-title">
            <div className="import__modal import__modal--purge">
              <h3 id="vaciar-title">Confirmar vaciado de inventario</h3>
              <p>
                Esta acción es <strong>irreversible</strong> para los datos en sesión: se perderán el inventario
                cargado y los movimientos. El historial de actividad previo permanece; se añadirá un registro de
                vaciado.
              </p>
              <p className="import__purge-hint">
                Escribe <strong>{CONFIRM_PURGE_TEXT}</strong> para habilitar el botón de confirmación:
              </p>
              <input
                type="text"
                className="product-list__filter-input import__purge-input"
                value={vaciarPhrase}
                onChange={(e) => setVaciarPhrase(e.target.value)}
                placeholder={CONFIRM_PURGE_TEXT}
                autoComplete="off"
                aria-label={`Escriba ${CONFIRM_PURGE_TEXT} para confirmar`}
                disabled={vaciarLoading}
              />
              <div className="import__modal-actions">
                <button
                  type="button"
                  className={`import__btn import__btn--danger ${isPurgeReady ? 'import__btn--ready' : ''}`}
                  onClick={handleVaciarInventario}
                  disabled={vaciarPhrase.trim() !== CONFIRM_PURGE_TEXT || vaciarLoading}
                >
                  {vaciarLoading ? 'Procesando…' : 'Sí, vaciar inventario'}
                </button>
                <button
                  type="button"
                  className="import__btn import__btn--secondary"
                  onClick={closeVaciarModal}
                  disabled={vaciarLoading}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div
            className={`import__result import__result--${
              result.blockingErrors?.length || result.warnings?.length ? 'partial' : 'ok'
            }`}
            role="status"
          >
            <p>
              <strong>
                {result.loadMode === 'actualizacion' &&
                result.createdCount != null &&
                result.updatedCount != null ? (
                  <>
                    {result.createdCount} alta(s), {result.updatedCount} actualización(es) ({result.imported} SKU únicos
                    aplicados)
                  </>
                ) : (
                  <>{result.imported} bienes importados</>
                )}
              </strong>{' '}
              correctamente.
            </p>
            {(result.duplicateRowsCollapsed ?? 0) > 0 && (
              <p className="import__result-meta">
                Filas del CSV fusionadas por SKU repetido: <strong>{result.duplicateRowsCollapsed}</strong> (se aplicó la
                última fila por cada SKU).
              </p>
            )}
            {result.fileName && (
              <p className="import__result-file">Archivo: <strong>{result.fileName}</strong></p>
            )}
            {result.totalDataRows != null && (
              <p className="import__result-meta">
                Filas leídas: {result.totalDataRows}. Errores bloqueantes: {result.blockingErrors?.length ?? 0}.
                Advertencias: {result.warnings?.length ?? 0}.
              </p>
            )}
            {(result.blockingErrors?.length > 0 || result.warnings?.length > 0) && (
              <>
                <p>Revisa el detalle en el reporte descargable.</p>
                <button type="button" className="import__btn import__btn--secondary" onClick={downloadResultReport}>
                  Descargar incidencias de esta carga
                </button>
              </>
            )}
            <button type="button" className="import__btn import__btn--secondary" onClick={() => navigate('/')}>
              Ver inventario
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export default ImportPage
