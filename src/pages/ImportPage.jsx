import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../context/InventoryContext'
import { parseCsvBienes, getCsvTemplateBlob } from '../utils/parseCsvBienes'

const downloadTemplate = () => {
  const blob = getCsvTemplateBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_inventario_bienes.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const ImportPage = () => {
  const [file, setFile] = useState(null)
  const [paste, setPaste] = useState('')
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)
  const { addBienesFromImport, totalCount } = useInventory()
  const navigate = useNavigate()

  const processCsv = (text) => {
    const { valid, errors } = parseCsvBienes(text)
    if (valid.length > 0) {
      addBienesFromImport(valid)
    }
    setResult({ imported: valid.length, errors })
    setPaste('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      processCsv(ev.target?.result ?? '')
    }
    reader.readAsText(f, 'UTF-8')
  }

  const handlePasteSubmit = (e) => {
    e.preventDefault()
    if (!paste.trim()) return
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
            <h3 className="import__block-title">1. Descargar plantilla CSV</h3>
            <p className="import__hint">Usa esta plantilla para preparar tus datos con el formato correcto.</p>
            <button type="button" className="import__btn import__btn--secondary" onClick={downloadTemplate}>
              Descargar plantilla
            </button>
          </div>

          <div className="import__block">
            <h3 className="import__block-title">2. Subir archivo CSV</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="import__file"
            />
          </div>

          <div className="import__block">
            <h3 className="import__block-title">3. O pegar CSV aquí</h3>
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

        <div className="import__format">
          <h4>Formato del CSV</h4>
          <p>Encabezado esperado (coma o punto y coma):</p>
          <code>codigoInventario,name,tipoBien,description,quantity,valorLibros,estadoVerificacion</code>
          <p>
            <strong>tipoBien:</strong> mueble | inmueble — <strong>estadoVerificacion:</strong> teorico |
            verificado_terreno | no_encontrado
          </p>
        </div>

        {result && (
          <div className={`import__result import__result--${result.errors?.length ? 'partial' : 'ok'}`} role="status">
            <p><strong>{result.imported} bienes importados</strong> correctamente.</p>
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
