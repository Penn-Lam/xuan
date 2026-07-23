// ============================================================
//  snap/types —— 智能吸附类型契约
//  坐标：frame 绝对坐标（与 absoluteRect 同系）
// ============================================================
import type { Rect } from "@/types/document"

export type Axis = "x" | "y"

export type SnapKind =
  | "edge"
  | "center"
  | "spacing"
  | "pattern"
  | "size"
  | "padding"
  | "grid"

export type SnapTargetSource = "sibling" | "parent" | "canvas"

export interface SnapMeasurement {
  orientation: "h" | "v"
  x1: number
  y1: number
  x2: number
  y2: number
  value: number
  kind: "distance" | "spacing" | "size"
}

export interface SnapCandidate {
  /** 稳定 id，迟滞锁定用 */
  id: string
  axis: Axis
  kind: SnapKind
  /** 施加到 self 位置的 delta（该轴）；size 见 sizeDelta */
  delta: number
  /** 引导线位置（对齐轴上的关键坐标） */
  guidePos: number
  /** 引导线段在正交轴上的 from→to */
  guideFrom: number
  guideTo: number
  priority: number
  /** |理想位置 - 当前位置| */
  error: number
  measurement?: SnapMeasurement
  /** resize 尺寸吸附：额外的宽高与原点修正 */
  sizeDelta?: { dw: number; dh: number; dx: number; dy: number }
}

export interface SnapGuide {
  orientation: "h" | "v"
  position: number
  from: number
  to: number
  kind: SnapKind
}

export interface SnapFrameInput {
  /** 未吸附的绝对 rect（move 时为 group 或 primary） */
  rawRect: Rect
  /** 对齐目标（同父非移动节点等） */
  targets: Rect[]
  parentRect: Rect
  canvasRect: Rect
  zoom: number
  mode: "move" | "resize"
  resizeEdges?: { n?: boolean; s?: boolean; e?: boolean; w?: boolean }
  /** 是否生成布局网格 / 像素网格候选 */
  enableLayoutGrid?: boolean
  enablePixelGrid?: boolean
}

export interface SnapFrameResult {
  deltaX: number
  deltaY: number
  /** resize 合并后的尺寸修正（已含位置） */
  sizeDelta?: { dw: number; dh: number; dx: number; dy: number }
  guides: SnapGuide[]
  measurements: SnapMeasurement[]
  /** 吸附后的绝对 rect（move 仅平移；resize 含尺寸） */
  adjustedRect: Rect
}

export interface RectEdges {
  left: number
  centerX: number
  right: number
  top: number
  centerY: number
  bottom: number
  w: number
  h: number
}
