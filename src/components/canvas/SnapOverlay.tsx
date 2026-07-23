// ============================================================
//  SnapOverlay —— 吸附引导线 + 间距/尺寸数值标注
//  坐标为 frame 绝对坐标；字号/线宽按 1/zoom 补偿
// ============================================================
import { useSnapStore, type SnapGuide, type SnapMeasurement } from "./useCanvasSnap"

interface SnapOverlayProps {
  zoom: number
}

export function SnapOverlay({ zoom }: SnapOverlayProps) {
  const guides = useSnapStore((s) => s.guides)
  const measurements = useSnapStore((s) => s.measurements)
  const z = Math.max(0.05, zoom)
  const stroke = 1 / z
  const fontSize = 11 / z

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-visible">
      {guides.map((g, i) => (
        <GuideLine key={`${g.orientation}-${g.position}-${g.from}-${i}`} guide={g} stroke={stroke} />
      ))}
      {measurements.map((m, i) => (
        <MeasurementLabel
          key={`${m.kind}-${m.x1}-${m.y1}-${m.value}-${i}`}
          m={m}
          stroke={stroke}
          fontSize={fontSize}
        />
      ))}
    </div>
  )
}

function guideColor(kind: SnapGuide["kind"]): string {
  switch (kind) {
    case "spacing":
    case "pattern":
      return "bg-pink-500"
    case "size":
      return "bg-violet-500"
    case "padding":
      return "bg-amber-500"
    case "grid":
      return "bg-muted-foreground/40"
    default:
      return "bg-pink-500"
  }
}

function GuideLine({ guide, stroke }: { guide: SnapGuide; stroke: number }) {
  const color = guideColor(guide.kind)
  if (guide.orientation === "v") {
    const h = Math.max(0, guide.to - guide.from)
    return (
      <div
        className={`absolute ${color}`}
        style={{
          left: guide.position,
          top: guide.from,
          width: stroke,
          height: h,
        }}
      />
    )
  }
  const w = Math.max(0, guide.to - guide.from)
  return (
    <div
      className={`absolute ${color}`}
      style={{
        top: guide.position,
        left: guide.from,
        height: stroke,
        width: w,
      }}
    />
  )
}

function MeasurementLabel({
  m,
  stroke,
  fontSize,
}: {
  m: SnapMeasurement
  stroke: number
  fontSize: number
}) {
  const midX = (m.x1 + m.x2) / 2
  const midY = (m.y1 + m.y2) / 2
  const isH = m.orientation === "h"

  return (
    <div className="absolute" style={{ left: 0, top: 0 }}>
      {/* 尺寸/间距连线 */}
      <div
        className="absolute bg-pink-500"
        style={
          isH
            ? {
                left: Math.min(m.x1, m.x2),
                top: midY,
                width: Math.abs(m.x2 - m.x1),
                height: stroke,
              }
            : {
                left: midX,
                top: Math.min(m.y1, m.y2),
                width: stroke,
                height: Math.abs(m.y2 - m.y1),
              }
        }
      />
      {/* 端点小竖/横 */}
      {isH ? (
        <>
          <div
            className="absolute bg-pink-500"
            style={{ left: m.x1, top: midY - 4, width: stroke, height: 8 }}
          />
          <div
            className="absolute bg-pink-500"
            style={{ left: m.x2, top: midY - 4, width: stroke, height: 8 }}
          />
        </>
      ) : (
        <>
          <div
            className="absolute bg-pink-500"
            style={{ left: midX - 4, top: m.y1, width: 8, height: stroke }}
          />
          <div
            className="absolute bg-pink-500"
            style={{ left: midX - 4, top: m.y2, width: 8, height: stroke }}
          />
        </>
      )}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-pink-500 px-1 font-mono text-white"
        style={{
          left: midX,
          top: midY,
          fontSize,
          lineHeight: 1.2,
          paddingInline: fontSize * 0.35,
          paddingBlock: fontSize * 0.15,
        }}
      >
        {m.value}
      </div>
    </div>
  )
}
