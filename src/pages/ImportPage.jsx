import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../context/InventoryContext'
import { parseCsvBienes, getHeaderMapping, EXAMPLE_CSV_HEADER } from '../utils/parseCsvBienes'

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
  const [file, setFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [paste, setPaste] = useState('')
  const [result, setResult] = useState(null)
  const [mappingPreview, setMappingPreview] = useState(() => getHeaderMapping(EXAMPLE_CSV_HEADER + '\n'))
  const fileInputRef = useRef(null)
  const { addBienesFromImport, totalCount } = useInventory()
  const navigate = useNavigate()

  const processCsv = (text, source = 'paste') => {
    const { valid, errors } = parseCsvBienes(text)
    if (valid.length > 0) {
      addBienesFromImport(valid)
    }
    setResult({ imported: valid.length, errors, fileName: source === 'file' ? file?.name : null })
    setPaste('')
    if (source === 'paste' || source === 'file') {
      if (source === 'file') {
        setFileContent('')
      }
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result ?? ''
      setFileContent(text)
      setMappingPreview(getHeaderMapping(text))
      setResult(null)
    }
    reader.readAsText(f, 'UTF-8')
  }

  const handleFileUpload = () => {
    if (!file || !fileContent) return
    processCsv(fileContent, 'file')
  }

  const handlePasteSubmit = (e) => {
    e.preventDefault()
    if (!paste.trim()) return
    setMappingPreview(getHeaderMapping(paste))
    processCsv(paste)
  }

  return (
    <div className="page import-page">
      <section className="import">
        <h2 className="import__title">Cargar inventario (hasta 9.000 bienes)</h2>
        <p className="import__subtitle">
          Sube un archivo CSV o pega el contenido. Los nuevos bienes se agregan al inventario actual.
        </p>
        <p className="import__count">
          <strong>Total actual en inventario: {totalCount} bienes</strong>
        </p>

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
            {file && (
              <button
                type="button"
                className="import__btn"
                onClick={handleFileUpload}
                disabled={!fileContent}
              >
                Subir
              </button>
            )}
          </div>

          <div className="import__block">
            <h3 className="import__block-title">2. O pegar CSV aquí</h3>
            <form onSubmit={handlePasteSubmit}>
              <textarea
                className="import__textarea"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="Pega aquí el contenido del CSV (primera fila = encabezado)"
                rows={6}
              />
              <button type="submit" className="import__btn" disabled={!paste.trim()}>
                Importar desde texto
              </button>
            </form>
          </div>
        </div>

        <div className="import__mapping import__format">
          <h4>Mapeo de columnas del CSV</h4>
          <p className="import__mapping-desc">
            Cada columna de tu archivo se asocia a un campo del sistema. Las columnas reconocidas se marcan con ✓;
            las que no tienen correspondencia aparecen con ✗ y no se usan en la importación.
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

        {result && (
          <div className={`import__result import__result--${result.errors?.length ? 'partial' : 'ok'}`} role="status">
            <p><strong>{result.imported} bienes importados</strong> correctamente.</p>
            {result.fileName && (
              <p className="import__result-file">Archivo cargado: <strong>{result.fileName}</strong></p>
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
