// ============================================================
//  snap/types —— 对齐 tldraw SnapManager 指标模型
//  points = 边/中心点对齐线；gaps = 等间距指示
// ============================================================
import type { Rect } from "@/types/document"

export interface Vec2 {
  x: number
  y: number
}

/** 点对齐指示：一条线上的多个锚点（角/中心） */
export interface PointsSnapIndicator {
  id: string
  type: "points"
  points: Vec2[]
}

/** 等间距指示：一组 gap 的起止边 */
export interface GapsSnapIndicator {
  id: string
  type: "gaps"
  direction: "horizontal" | "vertical"
  gaps: Array<{
    startEdge: [Vec2, Vec2]
    endEdge: [Vec2, Vec2]
  }>
}

export type SnapIndicator = PointsSnapIndicator | GapsSnapIndicator

/** 可吸附目标：id + 绝对 bounds */
export interface SnapTarget {
  id: string
  bounds: Rect
}

export interface SnapTranslateInput {
  /** 拖拽开始时的选区外接矩形（绝对） */
  initialSelectionBounds: Rect
  /** 指针位移（document 单位） */
  dragDelta: { x: number; y: number }
  /** 非选中的吸附目标 */
  targets: SnapTarget[]
  /** 阈值（document 单位，已 /zoom） */
  threshold: number
  /** 锁定轴（Shift 时可选） */
  lockedAxis?: "x" | "y" | null
}

export interface SnapTranslateResult {
  nudge: { x: number; y: number }
  indicators: SnapIndicator[]
  /** 吸附后的选区 bounds */
  snappedBounds: Rect
}

export interface SnapResizeInput {
  initialBounds: Rect
  /** 当前未吸附的 resize 后 bounds（绝对） */
  rawBounds: Rect
  targets: SnapTarget[]
  threshold: number
  /** 正在拖的边 */
  edges: { n?: boolean; s?: boolean; e?: boolean; w?: boolean }
}

export interface SnapResizeResult {
  nudge: { x: number; y: number }
  indicators: SnapIndicator[]
  snappedBounds: Rect
}

/** @deprecated 兼容旧 store 字段名 */
export type SnapGuide = PointsSnapIndicator | GapsSnapIndicator
export type SnapMeasurement = never
