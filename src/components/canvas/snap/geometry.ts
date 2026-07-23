// ============================================================
//  snap/geometry —— 吸附用几何小工具
// ============================================================
import type { Rect } from "@/types/document"
import type { RectEdges } from "./types"

export function edgesOf(r: Rect): RectEdges {
  return {
    left: r.x,
    centerX: r.x + r.w / 2,
    right: r.x + r.w,
    top: r.y,
    centerY: r.y + r.h / 2,
    bottom: r.y + r.h,
    w: r.w,
    h: r.h,
  }
}

/** 多 rect 外接矩形 */
export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** 两区间投影重叠长度 */
export function rangeOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

/** 正交轴投影重叠区间（用于短引导线 from/to） */
export function guideSpan(
  selfFrom: number,
  selfTo: number,
  targetFrom: number,
  targetTo: number,
  pad = 4,
): { from: number; to: number } {
  const from = Math.min(selfFrom, targetFrom) - pad
  const to = Math.max(selfTo, targetTo) + pad
  return { from, to }
}

/** 平移 rect */
export function translateRect(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }
}

/** 众数 gap（浮点按 round 归并） */
export function modeGap(gaps: number[], eps = 0.5): number | null {
  if (gaps.length === 0) return null
  const buckets = new Map<number, { sum: number; n: number }>()
  for (const g of gaps) {
    if (g <= 0) continue
    const key = Math.round(g / eps) * eps
    const b = buckets.get(key) ?? { sum: 0, n: 0 }
    b.sum += g
    b.n += 1
    buckets.set(key, b)
  }
  let best: { avg: number; n: number } | null = null
  for (const b of buckets.values()) {
    if (!best || b.n > best.n) best = { avg: b.sum / b.n, n: b.n }
  }
  return best && best.n >= 1 ? best.avg : null
}
