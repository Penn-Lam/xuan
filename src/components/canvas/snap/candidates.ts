// ============================================================
//  snap/candidates —— 对齐 / padding / size / grid 候选
// ============================================================
import type { Rect } from "@/types/document"
import { priorityFor, DEFAULT_PADDINGS, LAYOUT_GRID_STEP } from "./constants"
import { edgesOf, guideSpan } from "./geometry"
import type {
  SnapCandidate,
  SnapFrameInput,
  SnapTargetSource,
  SnapMeasurement,
} from "./types"

type XKey = "left" | "centerX" | "right"
type YKey = "top" | "centerY" | "bottom"

const X_KEYS: XKey[] = ["left", "centerX", "right"]
const Y_KEYS: YKey[] = ["top", "centerY", "bottom"]

function isCenter(key: string): boolean {
  return key === "centerX" || key === "centerY"
}

/** 边/中心对齐：self × target 所有关键线 */
export function alignCandidates(
  self: Rect,
  target: Rect,
  source: SnapTargetSource,
  sourceId: string,
): SnapCandidate[] {
  const s = edgesOf(self)
  const t = edgesOf(target)
  const out: SnapCandidate[] = []

  for (const sk of X_KEYS) {
    for (const tk of X_KEYS) {
      const error = Math.abs(s[sk] - t[tk])
      const delta = t[tk] - s[sk]
      const kind = isCenter(sk) || isCenter(tk) ? "center" : "edge"
      const span = guideSpan(self.y, self.y + self.h, target.y, target.y + target.h)
      out.push({
        id: `align:x:${sourceId}:${sk}-${tk}`,
        axis: "x",
        kind,
        delta,
        guidePos: t[tk],
        guideFrom: span.from,
        guideTo: span.to,
        priority: priorityFor(kind, source),
        error,
        measurement: distanceMeasurement("v", self, target, t[tk]),
      })
    }
  }

  for (const sk of Y_KEYS) {
    for (const tk of Y_KEYS) {
      const error = Math.abs(s[sk] - t[tk])
      const delta = t[tk] - s[sk]
      const kind = isCenter(sk) || isCenter(tk) ? "center" : "edge"
      const span = guideSpan(self.x, self.x + self.w, target.x, target.x + target.w)
      out.push({
        id: `align:y:${sourceId}:${sk}-${tk}`,
        axis: "y",
        kind,
        delta,
        guidePos: t[tk],
        guideFrom: span.from,
        guideTo: span.to,
        priority: priorityFor(kind, source),
        error,
        measurement: distanceMeasurement("h", self, target, t[tk]),
      })
    }
  }

  return out
}

/** 对齐时的距离标注：仅当边对边（非中心）且有间隙时显示 */
function distanceMeasurement(
  orientation: "h" | "v",
  self: Rect,
  target: Rect,
  _guidePos: number,
): SnapMeasurement | undefined {
  if (orientation === "v") {
    // 垂直引导 = x 对齐；标注两者之间水平间隙
    const gapRight = target.x - (self.x + self.w)
    const gapLeft = self.x - (target.x + target.w)
    let gap = 0
    let x1 = 0
    let x2 = 0
    if (gapRight > 0.5) {
      gap = gapRight
      x1 = self.x + self.w
      x2 = target.x
    } else if (gapLeft > 0.5) {
      gap = gapLeft
      x1 = target.x + target.w
      x2 = self.x
    } else {
      return undefined
    }
    const y = (Math.max(self.y, target.y) + Math.min(self.y + self.h, target.y + target.h)) / 2
    return {
      orientation: "h",
      x1,
      y1: y,
      x2,
      y2: y,
      value: Math.round(gap),
      kind: "distance",
    }
  }
  const gapBottom = target.y - (self.y + self.h)
  const gapTop = self.y - (target.y + target.h)
  let gap = 0
  let y1 = 0
  let y2 = 0
  if (gapBottom > 0.5) {
    gap = gapBottom
    y1 = self.y + self.h
    y2 = target.y
  } else if (gapTop > 0.5) {
    gap = gapTop
    y1 = target.y + target.h
    y2 = self.y
  } else {
    return undefined
  }
  const x = (Math.max(self.x, target.x) + Math.min(self.x + self.w, target.x + target.w)) / 2
  return {
    orientation: "v",
    x1: x,
    y1,
    x2: x,
    y2,
    value: Math.round(gap),
    kind: "distance",
  }
}

/** 父内边距吸附 */
export function paddingCandidates(self: Rect, parent: Rect, targets: Rect[]): SnapCandidate[] {
  const pads = new Set<number>(DEFAULT_PADDINGS)
  // 从现有子节点推断一致 inset
  for (const side of ["left", "right", "top", "bottom"] as const) {
    const values: number[] = []
    for (const t of targets) {
      if (side === "left") values.push(t.x - parent.x)
      if (side === "right") values.push(parent.x + parent.w - (t.x + t.w))
      if (side === "top") values.push(t.y - parent.y)
      if (side === "bottom") values.push(parent.y + parent.h - (t.y + t.h))
    }
    if (values.length >= 2) {
      const rounded = values.map((v) => Math.round(v))
      const first = rounded[0]
      if (first >= 0 && rounded.every((v) => v === first)) pads.add(first)
    }
  }

  const out: SnapCandidate[] = []
  const s = edgesOf(self)
  for (const pad of pads) {
    // left
    {
      const target = parent.x + pad
      const delta = target - s.left
      out.push({
        id: `pad:left:${pad}`,
        axis: "x",
        kind: "padding",
        delta,
        guidePos: target,
        guideFrom: parent.y,
        guideTo: parent.y + parent.h,
        priority: priorityFor("padding"),
        error: Math.abs(delta),
        measurement: {
          orientation: "h",
          x1: parent.x,
          y1: s.centerY,
          x2: target,
          y2: s.centerY,
          value: pad,
          kind: "distance",
        },
      })
    }
    // right
    {
      const target = parent.x + parent.w - pad
      const delta = target - s.right
      out.push({
        id: `pad:right:${pad}`,
        axis: "x",
        kind: "padding",
        delta,
        guidePos: target,
        guideFrom: parent.y,
        guideTo: parent.y + parent.h,
        priority: priorityFor("padding"),
        error: Math.abs(delta),
        measurement: {
          orientation: "h",
          x1: target,
          y1: s.centerY,
          x2: parent.x + parent.w,
          y2: s.centerY,
          value: pad,
          kind: "distance",
        },
      })
    }
    // top
    {
      const target = parent.y + pad
      const delta = target - s.top
      out.push({
        id: `pad:top:${pad}`,
        axis: "y",
        kind: "padding",
        delta,
        guidePos: target,
        guideFrom: parent.x,
        guideTo: parent.x + parent.w,
        priority: priorityFor("padding"),
        error: Math.abs(delta),
        measurement: {
          orientation: "v",
          x1: s.centerX,
          y1: parent.y,
          x2: s.centerX,
          y2: target,
          value: pad,
          kind: "distance",
        },
      })
    }
    // bottom
    {
      const target = parent.y + parent.h - pad
      const delta = target - s.bottom
      out.push({
        id: `pad:bottom:${pad}`,
        axis: "y",
        kind: "padding",
        delta,
        guidePos: target,
        guideFrom: parent.x,
        guideTo: parent.x + parent.w,
        priority: priorityFor("padding"),
        error: Math.abs(delta),
        measurement: {
          orientation: "v",
          x1: s.centerX,
          y1: target,
          x2: s.centerX,
          y2: parent.y + parent.h,
          value: pad,
          kind: "distance",
        },
      })
    }
  }
  return out
}

/** 父相对布局网格 + 可选像素网格（最低优先级） */
export function gridCandidates(
  self: Rect,
  parent: Rect,
  enableLayoutGrid: boolean,
  enablePixelGrid: boolean,
  zoom: number,
): SnapCandidate[] {
  const out: SnapCandidate[] = []
  if (enableLayoutGrid) {
    const step = LAYOUT_GRID_STEP
    // 只对 left/top 吸到最近网格线（相对 parent）
    const relX = self.x - parent.x
    const relY = self.y - parent.y
    const snapX = Math.round(relX / step) * step
    const snapY = Math.round(relY / step) * step
    const targetX = parent.x + snapX
    const targetY = parent.y + snapY
    out.push({
      id: `grid:layout:x:${snapX}`,
      axis: "x",
      kind: "grid",
      delta: targetX - self.x,
      guidePos: targetX,
      guideFrom: self.y,
      guideTo: self.y + self.h,
      priority: priorityFor("grid"),
      error: Math.abs(targetX - self.x),
    })
    out.push({
      id: `grid:layout:y:${snapY}`,
      axis: "y",
      kind: "grid",
      delta: targetY - self.y,
      guidePos: targetY,
      guideFrom: self.x,
      guideTo: self.x + self.w,
      priority: priorityFor("grid"),
      error: Math.abs(targetY - self.y),
    })
  }
  if (enablePixelGrid) {
    const gridSize = Math.pow(2, Math.ceil(Math.log2(4 / Math.max(0.05, zoom))))
    const sx = Math.round(self.x / gridSize) * gridSize
    const sy = Math.round(self.y / gridSize) * gridSize
    out.push({
      id: `grid:pixel:x:${sx}`,
      axis: "x",
      kind: "grid",
      delta: sx - self.x,
      guidePos: sx,
      guideFrom: self.y,
      guideTo: self.y + self.h,
      priority: priorityFor("grid") + 5,
      error: Math.abs(sx - self.x),
    })
    out.push({
      id: `grid:pixel:y:${sy}`,
      axis: "y",
      kind: "grid",
      delta: sy - self.y,
      guidePos: sy,
      guideFrom: self.x,
      guideTo: self.x + self.w,
      priority: priorityFor("grid") + 5,
      error: Math.abs(sy - self.y),
    })
  }
  return out
}

/** resize：同宽/同高 */
export function sizeCandidates(
  self: Rect,
  targets: Rect[],
  edges: NonNullable<SnapFrameInput["resizeEdges"]>,
): SnapCandidate[] {
  const out: SnapCandidate[] = []
  const canW = edges.e || edges.w
  const canH = edges.s || edges.n

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    if (canW) {
      const dw = t.w - self.w
      const dx = edges.w && !edges.e ? -dw : 0
      out.push({
        id: `size:w:${i}:${t.w}`,
        axis: "x",
        kind: "size",
        delta: dx,
        guidePos: edges.e ? self.x + t.w : self.x,
        guideFrom: Math.min(self.y, t.y),
        guideTo: Math.max(self.y + self.h, t.y + t.h),
        priority: priorityFor("size"),
        error: Math.abs(dw),
        sizeDelta: { dw, dh: 0, dx, dy: 0 },
        measurement: {
          orientation: "h",
          x1: self.x,
          y1: self.y - 12,
          x2: self.x + t.w,
          y2: self.y - 12,
          value: Math.round(t.w),
          kind: "size",
        },
      })
    }
    if (canH) {
      const dh = t.h - self.h
      const dy = edges.n && !edges.s ? -dh : 0
      out.push({
        id: `size:h:${i}:${t.h}`,
        axis: "y",
        kind: "size",
        delta: dy,
        guidePos: edges.s ? self.y + t.h : self.y,
        guideFrom: Math.min(self.x, t.x),
        guideTo: Math.max(self.x + self.w, t.x + t.w),
        priority: priorityFor("size"),
        error: Math.abs(dh),
        sizeDelta: { dw: 0, dh, dx: 0, dy },
        measurement: {
          orientation: "v",
          x1: self.x - 12,
          y1: self.y,
          x2: self.x - 12,
          y2: self.y + t.h,
          value: Math.round(t.h),
          kind: "size",
        },
      })
    }
  }
  return out
}

/** 汇总对齐类候选（兄弟 + 父 + 画布） */
export function collectAlignCandidates(input: SnapFrameInput): SnapCandidate[] {
  const self = input.rawRect
  const out: SnapCandidate[] = []
  input.targets.forEach((t, i) => {
    out.push(...alignCandidates(self, t, "sibling", `sib-${i}`))
  })
  out.push(...alignCandidates(self, input.parentRect, "parent", "parent"))
  // canvas 与 parent 不同时才加（避免重复）
  const c = input.canvasRect
  const p = input.parentRect
  if (c.x !== p.x || c.y !== p.y || c.w !== p.w || c.h !== p.h) {
    out.push(...alignCandidates(self, c, "canvas", "canvas"))
  }

  // resize：把边对齐转成 sizeDelta，避免只平移导致对边跟着动
  if (input.mode === "resize" && input.resizeEdges) {
    return out.map((cand) => resizeAwareCandidate(cand, self, input.resizeEdges!))
  }
  return out
}

/** resize 时：x 轴 delta → 作用在被拖的边上（改 w 或 x+w） */
function resizeAwareCandidate(
  cand: SnapCandidate,
  _self: Rect,
  edges: NonNullable<SnapFrameInput["resizeEdges"]>,
): SnapCandidate {
  if (cand.kind === "size") return cand
  if (cand.axis === "x") {
    if (edges.e && !edges.w) {
      // 右边缘：delta 变为 dw
      return {
        ...cand,
        delta: 0,
        sizeDelta: { dw: cand.delta, dh: 0, dx: 0, dy: 0 },
        error: Math.abs(cand.delta),
      }
    }
    if (edges.w && !edges.e) {
      return {
        ...cand,
        delta: cand.delta,
        sizeDelta: { dw: -cand.delta, dh: 0, dx: cand.delta, dy: 0 },
        error: Math.abs(cand.delta),
      }
    }
  }
  if (cand.axis === "y") {
    if (edges.s && !edges.n) {
      return {
        ...cand,
        delta: 0,
        sizeDelta: { dw: 0, dh: cand.delta, dx: 0, dy: 0 },
        error: Math.abs(cand.delta),
      }
    }
    if (edges.n && !edges.s) {
      return {
        ...cand,
        delta: cand.delta,
        sizeDelta: { dw: 0, dh: -cand.delta, dx: 0, dy: cand.delta },
        error: Math.abs(cand.delta),
      }
    }
  }
  return cand
}
