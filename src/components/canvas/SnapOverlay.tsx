// ============================================================
//  SnapOverlay —— tldraw 风格对齐线 + 等间距指示
//  points：对角连线 + 叉号；gaps：端点 tick + 中线 + 中心 tick
// ============================================================
import { useSnapStore, type GapsSnapIndicator, type PointsSnapIndicator } from "./useCanvasSnap"

interface SnapOverlayProps {
  zoom: number
}

const SNAP_COLOR = "rgb(255, 62, 183)" // tldraw pink

export function SnapOverlay({ zoom }: SnapOverlayProps) {
  const indicators = useSnapStore((s) => s.indicators)
  const z = Math.max(0.05, zoom)
  const stroke = 1 / z

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-50 overflow-visible"
      style={{ width: "100%", height: "100%" }}
    >
      {indicators.map((line) =>
        line.type === "points" ? (
          <PointsIndicator key={line.id} line={line} zoom={z} stroke={stroke} />
        ) : (
          <GapsIndicator key={line.id} line={line} zoom={z} stroke={stroke} />
        ),
      )}
    </svg>
  )
}

function PointsIndicator({
  line,
  zoom,
  stroke,
}: {
  line: PointsSnapIndicator
  zoom: number
  stroke: number
}) {
  const { points } = line
  if (points.length === 0) return null

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }

  // tldraw：若存在 NW 点用 NW→SE，否则 NE→SW 方向
  let useNWtoSE = false
  for (const p of points) {
    if (p.x === minX && p.y === minY) {
      useNWtoSE = true
      break
    }
  }
  const x1 = minX
  const y1 = useNWtoSE ? minY : maxY
  const x2 = maxX
  const y2 = useNWtoSE ? maxY : minY
  const l = 2.5 / zoom

  return (
    <g stroke={SNAP_COLOR} strokeWidth={stroke} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {points.map((p, i) => (
        <g key={i}>
          <line x1={p.x - l} y1={p.y - l} x2={p.x + l} y2={p.y + l} />
          <line x1={p.x - l} y1={p.y + l} x2={p.x + l} y2={p.y - l} />
        </g>
      ))}
    </g>
  )
}

function GapsIndicator({
  line,
  zoom,
  stroke,
}: {
  line: GapsSnapIndicator
  zoom: number
  stroke: number
}) {
  const { gaps, direction } = line
  if (gaps.length === 0) return null

  const l = 3.5 / zoom
  const tickLength = 2 * l
  const horizontal = direction === "horizontal"

  // 计算共同 breadth 中点（tldraw rangeIntersection 链）
  let edgeIx: [number, number] = [-Infinity, Infinity]
  for (const gap of gaps) {
    const a0 = horizontal ? gap.startEdge[0].y : gap.startEdge[0].x
    const a1 = horizontal ? gap.startEdge[1].y : gap.startEdge[1].x
    const b0 = horizontal ? gap.endEdge[0].y : gap.endEdge[0].x
    const b1 = horizontal ? gap.endEdge[1].y : gap.endEdge[1].x
    const from = Math.max(edgeIx[0], Math.min(a0, a1), Math.min(b0, b1))
    const to = Math.min(edgeIx[1], Math.max(a0, a1), Math.max(b0, b1))
    if (from < to) edgeIx = [from, to]
  }
  const mid = (edgeIx[0] + edgeIx[1]) / 2

  return (
    <g stroke={SNAP_COLOR} strokeWidth={stroke} fill="none">
      {gaps.map((gap, i) => {
        if (horizontal) {
          const x0 = gap.startEdge[0].x
          const x1 = gap.endEdge[0].x
          const cx = (x0 + x1) / 2
          return (
            <g key={i}>
              <line x1={x0} y1={mid - tickLength} x2={x0} y2={mid + tickLength} />
              <line x1={x1} y1={mid - tickLength} x2={x1} y2={mid + tickLength} />
              <line x1={x0} y1={mid} x2={x1} y2={mid} />
              <line x1={cx} y1={mid - l} x2={cx} y2={mid + l} />
            </g>
          )
        }
        const y0 = gap.startEdge[0].y
        const y1 = gap.endEdge[0].y
        const cy = (y0 + y1) / 2
        return (
          <g key={i}>
            <line x1={mid - tickLength} y1={y0} x2={mid + tickLength} y2={y0} />
            <line x1={mid - tickLength} y1={y1} x2={mid + tickLength} y2={y1} />
            <line x1={mid} y1={y0} x2={mid} y2={y1} />
            <line x1={mid - l} y1={cy} x2={mid + l} y2={cy} />
          </g>
        )
      })}
    </g>
  )
}
