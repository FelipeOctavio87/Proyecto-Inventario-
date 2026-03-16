import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import { parseCsvBienes, getHeaderMapping } from '../utils/parseCsvBienes'
import GestorImagenes from '../components/GestorImagenes'

const MAP_LABELS = {
  codigoInventario: 'Código inventario',
  name: 'Nombre',
  tipoBien: 'Tipo de bien',
  description: 'Descripción',
  quantity: 'Cantidad',
  valorLibros: 'Valor en libros',
  estadoVerificacion: 'Estado verificación',
}

const ImportPage = () => {
  const { isAdmin } = useAuth()
  const { addBienesFromImport, vaciarInventario, totalCount, totalUnidades } = useInventory()
  const navigate = useNavigate()

  const [file, setFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [mappingPreview, setMappingPreview] = useState([])
  const [loadMode, setLoadMode] = useState('actualizacion')
  const [result, setResult] = useState(null)
  const [showVaciarConfirm, setShowVaciarConfirm] = useState(false)
  const fileInputRef = useRef(null)

  const hasPreview = mappingPreview.length > 0
  const csvToProcess = fileContent

  const handleCancelLoad = () => {
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
    if (!csvToProcess.trim()) return
    const { valid, errors } = parseCsvBienes(csvToProcess)
    if (valid.length > 0) {
      addBienesFromImport(valid, { overwrite: loadMode === 'inicial' })
    }
    setResult({
      imported: valid.length,
      errors,
      fileName: file?.name ?? null,
    })
    handleCancelLoad()
  }

  const handleVaciarInventario = () => {
    vaciarInventario()
    setShowVaciarConfirm(false)
  }

  if (!isAdmin) {
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
          <div className="import__block mt-6">
            <h3 className="import__block-title">Gestor de imágenes</h3>
            <GestorImagenes />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page import-page">
      <section className="import">
        <h2 className="import__title">Cargar inventario</h2>
        <p className="import__subtitle">
          Sube un archivo CSV. La previsualización del mapeo no modifica la base de datos hasta que confirmes la carga.
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
          <div className="import__block">
            <h3 className="import__block-title">1. Subir archivo CSV</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="import__file"
            />
            {file && (
              <p className="import__file-name" role="status">
                Archivo seleccionado: <strong>{file.name}</strong>
              </p>
            )}
          </div>
        </div>

        {hasPreview && (
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
                <strong>Campos que reconoce la app:</strong> codigoInventario (o SKU), name (o Producto/Nombre), quantity (o Unidades), valorLibros (o Costo unitario), tipoBien, description, estadoVerificacion.
              </p>
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
                <span>Actualización Masiva</span> — Añade los datos del CSV al inventario existente.
              </label>

              <div className="import__confirm-actions">
                <button
                  type="button"
                  className="import__btn"
                  onClick={handleConfirmarCarga}
                  disabled={!csvToProcess.trim()}
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

        <div className="import__block import__block--vaciar">
          <h3 className="import__block-title">Vaciar inventario</h3>
          <p className="import__vaciar-desc">
            Solo para casos de error en la carga. Elimina todos los bienes, movimientos e historial. Solo Administrador.
          </p>
          <button
            type="button"
            className="import__btn import__btn--danger"
            onClick={() => setShowVaciarConfirm(true)}
          >
            Vaciar inventario
          </button>
        </div>

        {showVaciarConfirm && (
          <div className="import__modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vaciar-title">
            <div className="import__modal">
              <h3 id="vaciar-title">¿Vaciar todo el inventario?</h3>
              <p>Se eliminarán todos los bienes, movimientos e historial. Esta acción no se puede deshacer.</p>
              <div className="import__modal-actions">
                <button type="button" className="import__btn import__btn--danger" onClick={handleVaciarInventario}>
                  Sí, vaciar
                </button>
                <button type="button" className="import__btn import__btn--secondary" onClick={() => setShowVaciarConfirm(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="import__block mt-6">
          <h3 className="import__block-title">Gestor de imágenes</h3>
          <GestorImagenes />
        </div>

        {result && (
          <div className={`import__result import__result--${result.errors?.length ? 'partial' : 'ok'}`} role="status">
            <p><strong>{result.imported} bienes importados</strong> correctamente.</p>
            {result.fileName && (
              <p className="import__result-file">Archivo: <strong>{result.fileName}</strong></p>
            )}
            {result.errors?.length > 0 && (
              <p>Filas con error: {result.errors.length}. Primeras: {result.errors.slice(0, 3).map((e) => `Fila ${e.row}: ${e.message}`).join('; ')}.</p>
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
