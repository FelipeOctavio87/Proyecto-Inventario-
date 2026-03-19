import Barcode from 'react-barcode'

const getBarcodeFormat = (value) => {
  const v = String(value ?? '').trim()
  if (/^\d+$/.test(v)) {
    if (v.length === 13) return 'EAN13'
    if (v.length === 12) return 'UPCA'
  }
  return 'CODE128'
}

export default function BarcodeDisplay({ value }) {
  const v = String(value ?? '').trim()
  if (!v) return null

  const format = getBarcodeFormat(v)

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900/30 p-4">
      <div className="text-xs text-slate-300 mb-2">
        Código de barras: <span className="text-slate-100 font-semibold">{v}</span>
      </div>
      <div className="flex items-center justify-start overflow-x-auto">
        <Barcode
          value={v}
          format={format}
          height={55}
          width={1.5}
          displayValue={false}
          margin={0}
          background="transparent"
          lineColor="#e5e7eb"
        />
      </div>
      <div className="text-[11px] text-slate-400 mt-2">
        Formato detectado: <span className="text-slate-300">{format}</span>
      </div>
    </div>
  )
}

