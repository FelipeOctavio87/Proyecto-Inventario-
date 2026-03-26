import { useLayoutEffect, useRef } from 'react'
import bwipjs from 'bwip-js'

const PrintableLabel = ({ item }) => {
  const matrixRef = useRef(null)

  useLayoutEffect(() => {
    if (!matrixRef.current || !item?.gs1LikeCode) return
    try {
      // bwip-js: toSVG(options) devuelve string SVG completa (síncrono).
      const svgMarkup = bwipjs.toSVG({
        bcid: 'datamatrix',
        text: item.gs1LikeCode,
        scale: 3,
        paddingwidth: 2,
        paddingheight: 2,
      })
      matrixRef.current.innerHTML = svgMarkup
    } catch (err) {
      // Mantener UI resiliente si hay un caso raro de codificación.
      console.error('Error generando DataMatrix (SVG):', err)
    }
  }, [item?.gs1LikeCode])

  const productName = String(item?.productName ?? '').trim()
  const shortName = productName.length > 28 ? `${productName.slice(0, 28)}…` : productName
  const serial = String(item?.serial ?? '').trim()

  return (
    <article className="label-item" aria-label={`Etiqueta ${serial}`}>
      <div className="label-item__matrix" aria-hidden="true" ref={matrixRef} />

      <div className="label-item__right">
        <div className="label-item__name" title={productName || '—'}>
          {shortName || '—'}
        </div>
        <div className="label-item__serial">{serial || '—'}</div>
      </div>
    </article>
  )
}

export default PrintableLabel

