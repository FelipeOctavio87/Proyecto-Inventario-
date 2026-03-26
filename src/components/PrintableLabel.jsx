import { useEffect, useRef } from 'react'
import bwipjs from 'bwip-js'

const PrintableLabel = ({ item }) => {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !item?.gs1LikeCode) return
    try {
      bwipjs.toCanvas(canvasRef.current, {
        bcid: 'datamatrix',
        text: item.gs1LikeCode,
        scale: 3,
        paddingwidth: 2,
        paddingheight: 2,
      })
    } catch (err) {
      // Keep UI resilient if an encoding edge-case happens.
      console.error('Error generando DataMatrix:', err)
    }
  }, [item])

  return (
    <article className="label-item" aria-label={`Etiqueta ${item?.serial ?? ''}`}>
      <div className="label-item__matrix">
        <canvas ref={canvasRef} />
      </div>
      <div className="label-item__meta">
        <p className="label-item__name" title={item?.productName}>
          {item?.productName}
        </p>
        <p><strong>SKU:</strong> {item?.sku}</p>
        <p><strong>Serial:</strong> {item?.serial}</p>
      </div>
    </article>
  )
}

export default PrintableLabel

