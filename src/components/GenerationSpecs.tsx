import { useState } from 'react'
import type { GenerationDetail } from '@lib/api'

type Field = [label: string, key: keyof GenerationDetail]

const SECTIONS: { title: string; icon: string; fields: Field[] }[] = [
  { title: 'Identity', icon: '🏷️', fields: [['Bike', 'bikeName'], ['Make', 'make'], ['Model', 'model'], ['Year', 'year'], ['Category', 'category']] },
  { title: 'Engine', icon: '🔧', fields: [['Type', 'engineType'], ['Displacement', 'displacementCc'], ['Cylinders', 'cylinders'], ['Bore × Stroke', 'boreStroke'], ['Compression', 'compressionRatio'], ['Valve System', 'valveSystem'], ['Fuel System', 'fuelSystem'], ['Cooling', 'coolingSystem'], ['Lubrication', 'lubrication'], ['Starter', 'starter']] },
  { title: 'Performance', icon: '⚡', fields: [['Power (HP)', 'powerHp'], ['Power (kW)', 'powerKw'], ['Torque (Nm)', 'torqueNm'], ['Torque (lb-ft)', 'torqueLbft'], ['Top Speed', 'topSpeed']] },
  { title: 'Transmission', icon: '⚙️', fields: [['Gearbox', 'gearbox'], ['Clutch', 'clutch'], ['Final Drive', 'finalDrive']] },
  { title: 'Chassis & Suspension', icon: '🏗️', fields: [['Frame', 'frameType'], ['Front Suspension', 'frontSuspension'], ['Rear Suspension', 'rearSuspension'], ['Front Travel', 'frontWheelTravel'], ['Rear Travel', 'rearWheelTravel']] },
  { title: 'Brakes & Tyres', icon: '🛑', fields: [['Front Brake', 'frontBrake'], ['Rear Brake', 'rearBrake'], ['ABS', 'abs'], ['Front Tyre', 'frontTyre'], ['Rear Tyre', 'rearTyre']] },
  { title: 'Dimensions & Weight', icon: '📐', fields: [['Length', 'lengthMm'], ['Width', 'widthMm'], ['Height', 'heightMm'], ['Seat Height', 'seatHeightMm'], ['Wheelbase', 'wheelbaseMm'], ['Ground Clearance', 'groundClearanceMm'], ['Dry Weight', 'dryWeightKg'], ['Wet Weight', 'wetWeightKg']] },
  { title: 'Fuel & Electrical', icon: '⛽', fields: [['Tank Capacity', 'fuelCapacityL'], ['Consumption', 'fuelConsumption'], ['Range', 'rangeKm'], ['Reserve', 'reserveL'], ['Alternator', 'alternator'], ['Battery', 'battery']] },
  { title: 'Info', icon: 'ℹ️', fields: [['Colors', 'colors'], ['Price (MSRP)', 'priceMsrp'], ['Rating', 'rating'], ['Reviews', 'reviewCount']] },
]

export const GenerationSpecs = ({ detail }: { detail: GenerationDetail | null }) => {
  const [showEmpty, setShowEmpty] = useState(false)

  if (!detail) {
    return <p className="text-sm text-gray-400 py-4 text-center">No specs scraped yet.</p>
  }

  const totalFields = SECTIONS.reduce((n, s) => n + s.fields.length, 0)
  const filled = SECTIONS.reduce((n, s) => n + s.fields.filter(([, k]) => detail[k]).length, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{filled} of {totalFields} fields available</p>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="rounded border-gray-300" />
          Show empty fields
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {SECTIONS.map((section) => {
          const rows = section.fields.filter(([, k]) => showEmpty || detail[k])
          if (rows.length === 0) return null
          return (
            <div key={section.title} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                {section.icon} {section.title}
              </h5>
              <dl className="space-y-1">
                {rows.map(([label, key]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <dt className="w-32 flex-shrink-0 text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-900 break-words min-w-0">{(detail[key] as string | null) || <span className="text-gray-300">—</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>

      {detail.description && (
        <div className="rounded-xl border border-gray-100 p-3.5">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">📝 Description</h5>
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{detail.description}</p>
        </div>
      )}

      {detail.sourceUrl && (
        <a href={detail.sourceUrl} target="_blank" rel="noreferrer" className="inline-block text-xs text-primary hover:underline break-all">
          Source: {detail.sourceUrl}
        </a>
      )}
    </div>
  )
}
