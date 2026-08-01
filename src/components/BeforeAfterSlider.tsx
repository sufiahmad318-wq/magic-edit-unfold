import { useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
}: {
  beforeSrc: string
  afterSrc: string
}) {
  const [pos, setPos] = useState(50)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)

  const update = (clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(0, Math.min(100, pct)))
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none touch-none"
      onPointerDown={(e) => {
        dragging.current = true
        update(e.clientX)
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        update(e.clientX)
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
    >
      <img src={afterSrc} alt="After" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img src={beforeSrc} alt="Before" className="absolute inset-0 w-full h-full object-contain" />
      </div>
      <div
        className="absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.6)]"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
          <MoveHorizontal size={15} className="text-black" />
        </div>
      </div>
      <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-1 rounded-md bg-black/60 text-white/90 pointer-events-none">
        BEFORE
      </span>
      <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-md bg-black/60 text-white/90 pointer-events-none">
        AFTER
      </span>
    </div>
  )
}
