// ============================================================
//  snap/geometry —— 区间与矩形工具（对齐 tldraw primitives）
// ============================================================
import type { Rect } from "@/types/document"
import type { Vec2 } from "./types"

export function round(x: number): number {
  // 与 tldraw 一致：抑制浮点误差
  return Math.round(x * 1e8) / 1e8
}

export function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1
}

export function rangeIntersection(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): [number, number] | null {
  const from = Math.max(a0, b0)
  const to = Math.min(a1, b1)
  if (from >= to) return null
  return [from, to]
}

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

export function translateRect(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }
}

/** 矩形四角 + 中心（tldraw cornersAndCenter） */
export function cornersAndCenter(r: Rect): Vec2[] {
  const { x, y, w, h } = r
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
    { x: x + w / 2, y: y + h / 2 },
  ]
}

export function rectSides(r: Rect): {
  top: [Vec2, Vec2]
  right: [Vec2, Vec2]
  bottom: [Vec2, Vec2]
  left: [Vec2, Vec2]
} {
  const { x, y, w, h } = r
  return {
    top: [
      { x, y },
      { x: x + w, y },
    ],
    right: [
      { x: x + w, y },
      { x: x + w, y: y + h },
    ],
    // bottom/left 升序（与 tldraw selectionSides 一致）
    bottom: [
      { x, y: y + h },
      { x: x + w, y: y + h },
    ],
    left: [
      { x, y },
      { x, y: y + h },
    ],
  }
}

export function dedupePoints(points: Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const p of points) {
    if (!out.some((q) => round(q.x) === round(p.x) && round(q.y) === round(p.y))) {
      out.push(p)
    }
  }
  return out
}
