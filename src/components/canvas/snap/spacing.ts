// ============================================================
//  snap/spacing —— 等间距 + 行/列/网格模式延续
// ============================================================
import type { Rect } from "@/types/document"
import {
  priorityFor,
  OVERLAP_RATIO,
  ROW_COL_CENTER_TOLERANCE,
  PATTERN_MAX_STEPS,
} from "./constants"
import { edgesOf, modeGap, rangeOverlap } from "./geometry"
import type { SnapCandidate } from "./types"

function yOverlapRatio(a: Rect, b: Rect): number {
  const o = rangeOverlap(a.y, a.y + a.h, b.y, b.y + b.h)
  return o / Math.max(1, Math.min(a.h, b.h))
}

function xOverlapRatio(a: Rect, b: Rect): number {
  const o = rangeOverlap(a.x, a.x + a.w, b.x, b.x + b.w)
  return o / Math.max(1, Math.min(a.w, b.w))
}

/**
 * 等间距候选：使 self 与邻居 gap 等于链上众数 gap，
 * 或夹在两邻居中间双侧等距。
 */
export function spacingCandidates(self: Rect, targets: Rect[]): SnapCandidate[] {
  const out: SnapCandidate[] = []

  // —— 水平（x 轴位移）——
  const rowPeers = targets
    .filter((t) => yOverlapRatio(self, t) >= OVERLAP_RATIO)
    .slice()
    .sort((a, b) => a.x - b.x)

  if (rowPeers.length >= 1) {
    const gaps: number[] = []
    for (let i = 0; i < rowPeers.length - 1; i++) {
      const g = rowPeers[i + 1].x - (rowPeers[i].x + rowPeers[i].w)
      if (g > 0) gaps.push(g)
    }
    const G = modeGap(gaps)

    for (const peer of rowPeers) {
      // 放到 peer 右侧 gap=G
      if (G != null) {
        const targetLeft = peer.x + peer.w + G
        const delta = targetLeft - self.x
        out.push(spacingCandX(self, peer, delta, G, `right-of-${peer.x}`))
        // 放到 peer 左侧
        const targetRight = peer.x - G
        const deltaL = targetRight - (self.x + self.w)
        out.push(spacingCandX(self, peer, deltaL, G, `left-of-${peer.x}`))
      }
    }

    // 夹在 intermediate 两邻居中间
    for (let i = 0; i < rowPeers.length - 1; i++) {
      const left = rowPeers[i]
      const right = rowPeers[i + 1]
      const span = right.x - (left.x + left.w)
      if (span <= self.w) continue
      const equalGap = (span - self.w) / 2
      if (equalGap <= 0) continue
      const targetLeft = left.x + left.w + equalGap
      const delta = targetLeft - self.x
      const midY =
        (Math.max(self.y, left.y, right.y) +
          Math.min(self.y + self.h, left.y + left.h, right.y + right.h)) /
        2
      out.push({
        id: `spacing:x:between:${left.x}-${right.x}`,
        axis: "x",
        kind: "spacing",
        delta,
        guidePos: targetLeft,
        guideFrom: Math.min(left.y, right.y),
        guideTo: Math.max(left.y + left.h, right.y + right.h),
        priority: priorityFor("spacing"),
        error: Math.abs(delta),
        measurement: {
          orientation: "h",
          x1: left.x + left.w,
          y1: midY,
          x2: targetLeft,
          y2: midY,
          value: Math.round(equalGap),
          kind: "spacing",
        },
      })
    }
  }

  // —— 垂直（y 轴位移）——
  const colPeers = targets
    .filter((t) => xOverlapRatio(self, t) >= OVERLAP_RATIO)
    .slice()
    .sort((a, b) => a.y - b.y)

  if (colPeers.length >= 1) {
    const gaps: number[] = []
    for (let i = 0; i < colPeers.length - 1; i++) {
      const g = colPeers[i + 1].y - (colPeers[i].y + colPeers[i].h)
      if (g > 0) gaps.push(g)
    }
    const G = modeGap(gaps)

    for (const peer of colPeers) {
      if (G != null) {
        const targetTop = peer.y + peer.h + G
        out.push(spacingCandY(self, peer, targetTop - self.y, G, `below-${peer.y}`))
        const targetBottom = peer.y - G
        out.push(
          spacingCandY(self, peer, targetBottom - (self.y + self.h), G, `above-${peer.y}`),
        )
      }
    }

    for (let i = 0; i < colPeers.length - 1; i++) {
      const top = colPeers[i]
      const bottom = colPeers[i + 1]
      const span = bottom.y - (top.y + top.h)
      if (span <= self.h) continue
      const equalGap = (span - self.h) / 2
      if (equalGap <= 0) continue
      const targetTop = top.y + top.h + equalGap
      const delta = targetTop - self.y
      const midX =
        (Math.max(self.x, top.x, bottom.x) +
          Math.min(self.x + self.w, top.x + top.w, bottom.x + bottom.w)) /
        2
      out.push({
        id: `spacing:y:between:${top.y}-${bottom.y}`,
        axis: "y",
        kind: "spacing",
        delta,
        guidePos: targetTop,
        guideFrom: Math.min(top.x, bottom.x),
        guideTo: Math.max(top.x + top.w, bottom.x + bottom.w),
        priority: priorityFor("spacing"),
        error: Math.abs(delta),
        measurement: {
          orientation: "v",
          x1: midX,
          y1: top.y + top.h,
          x2: midX,
          y2: targetTop,
          value: Math.round(equalGap),
          kind: "spacing",
        },
      })
    }
  }

  return out
}

function spacingCandX(
  self: Rect,
  peer: Rect,
  delta: number,
  gap: number,
  tag: string,
): SnapCandidate {
  const s = edgesOf(self)
  return {
    id: `spacing:x:${tag}:${gap}`,
    axis: "x",
    kind: "spacing",
    delta,
    guidePos: self.x + delta,
    guideFrom: Math.min(self.y, peer.y),
    guideTo: Math.max(self.y + self.h, peer.y + peer.h),
    priority: priorityFor("spacing"),
    error: Math.abs(delta),
    measurement: {
      orientation: "h",
      x1: delta >= 0 ? peer.x + peer.w : self.x + self.w + delta,
      y1: s.centerY,
      x2: delta >= 0 ? self.x + delta : peer.x,
      y2: s.centerY,
      value: Math.round(gap),
      kind: "spacing",
    },
  }
}

function spacingCandY(
  self: Rect,
  peer: Rect,
  delta: number,
  gap: number,
  tag: string,
): SnapCandidate {
  const s = edgesOf(self)
  return {
    id: `spacing:y:${tag}:${gap}`,
    axis: "y",
    kind: "spacing",
    delta,
    guidePos: self.y + delta,
    guideFrom: Math.min(self.x, peer.x),
    guideTo: Math.max(self.x + self.w, peer.x + peer.w),
    priority: priorityFor("spacing"),
    error: Math.abs(delta),
    measurement: {
      orientation: "v",
      x1: s.centerX,
      y1: delta >= 0 ? peer.y + peer.h : self.y + self.h + delta,
      x2: s.centerX,
      y2: delta >= 0 ? self.y + delta : peer.y,
      value: Math.round(gap),
      kind: "spacing",
    },
  }
}

/**
 * 行/列模式延续：检测同中心带上的规则间距，生成下一格位置。
 */
export function patternCandidates(
  self: Rect,
  targets: Rect[],
  zoom: number,
): SnapCandidate[] {
  const tol = ROW_COL_CENTER_TOLERANCE / Math.max(0.05, zoom)
  const out: SnapCandidate[] = []
  const sc = edgesOf(self)

  // 行：y 中心接近
  const row = targets
    .filter((t) => Math.abs(edgesOf(t).centerY - sc.centerY) <= tol)
    .slice()
    .sort((a, b) => a.x - b.x)

  if (row.length >= 2) {
    const gaps: number[] = []
    for (let i = 0; i < row.length - 1; i++) {
      // 中心距或边距：用左边缘间距更稳
      const g = row[i + 1].x - row[i].x
      if (g > 0) gaps.push(g)
    }
    const G = modeGap(gaps)
    if (G != null && G > 0) {
      for (let step = 1; step <= PATTERN_MAX_STEPS; step++) {
        const last = row[row.length - 1]
        const first = row[0]
        // 右侧续
        {
          const targetX = last.x + G * step
          const delta = targetX - self.x
          out.push({
            id: `pattern:row:right:${step}:${G}`,
            axis: "x",
            kind: "pattern",
            delta,
            guidePos: targetX,
            guideFrom: Math.min(...row.map((r) => r.y), self.y),
            guideTo: Math.max(...row.map((r) => r.y + r.h), self.y + self.h),
            priority: priorityFor("pattern"),
            error: Math.abs(delta),
          })
        }
        // 左侧续
        {
          const targetX = first.x - G * step
          const delta = targetX - self.x
          out.push({
            id: `pattern:row:left:${step}:${G}`,
            axis: "x",
            kind: "pattern",
            delta,
            guidePos: targetX,
            guideFrom: Math.min(...row.map((r) => r.y), self.y),
            guideTo: Math.max(...row.map((r) => r.y + r.h), self.y + self.h),
            priority: priorityFor("pattern"),
            error: Math.abs(delta),
          })
        }
      }
      // 同时吸 y 到行中心
      const rowCY = row.reduce((s, r) => s + edgesOf(r).centerY, 0) / row.length
      const deltaY = rowCY - sc.centerY
      out.push({
        id: `pattern:row:cy:${rowCY}`,
        axis: "y",
        kind: "pattern",
        delta: deltaY,
        guidePos: rowCY,
        guideFrom: Math.min(...row.map((r) => r.x), self.x),
        guideTo: Math.max(...row.map((r) => r.x + r.w), self.x + self.w),
        priority: priorityFor("pattern"),
        error: Math.abs(deltaY),
      })
    }
  }

  // 列：x 中心接近
  const col = targets
    .filter((t) => Math.abs(edgesOf(t).centerX - sc.centerX) <= tol)
    .slice()
    .sort((a, b) => a.y - b.y)

  if (col.length >= 2) {
    const gaps: number[] = []
    for (let i = 0; i < col.length - 1; i++) {
      const g = col[i + 1].y - col[i].y
      if (g > 0) gaps.push(g)
    }
    const G = modeGap(gaps)
    if (G != null && G > 0) {
      for (let step = 1; step <= PATTERN_MAX_STEPS; step++) {
        const last = col[col.length - 1]
        const first = col[0]
        {
          const targetY = last.y + G * step
          const delta = targetY - self.y
          out.push({
            id: `pattern:col:below:${step}:${G}`,
            axis: "y",
            kind: "pattern",
            delta,
            guidePos: targetY,
            guideFrom: Math.min(...col.map((r) => r.x), self.x),
            guideTo: Math.max(...col.map((r) => r.x + r.w), self.x + self.w),
            priority: priorityFor("pattern"),
            error: Math.abs(delta),
          })
        }
        {
          const targetY = first.y - G * step
          const delta = targetY - self.y
          out.push({
            id: `pattern:col:above:${step}:${G}`,
            axis: "y",
            kind: "pattern",
            delta,
            guidePos: targetY,
            guideFrom: Math.min(...col.map((r) => r.x), self.x),
            guideTo: Math.max(...col.map((r) => r.x + r.w), self.x + self.w),
            priority: priorityFor("pattern"),
            error: Math.abs(delta),
          })
        }
      }
      const colCX = col.reduce((s, r) => s + edgesOf(r).centerX, 0) / col.length
      const deltaX = colCX - sc.centerX
      out.push({
        id: `pattern:col:cx:${colCX}`,
        axis: "x",
        kind: "pattern",
        delta: deltaX,
        guidePos: colCX,
        guideFrom: Math.min(...col.map((r) => r.y), self.y),
        guideTo: Math.max(...col.map((r) => r.y + r.h), self.y + self.h),
        priority: priorityFor("pattern"),
        error: Math.abs(deltaX),
      })
    }
  }

  return out
}
