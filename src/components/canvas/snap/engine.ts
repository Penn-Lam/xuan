// ============================================================
//  snap/engine —— SnapSession 门面（tldraw 风格 bounds snap）
// ============================================================
import {
  snapResize,
  snapTranslate,
  thresholdFromZoom,
  SNAP_THRESHOLD_SCREEN,
} from "./boundsSnap"
import type {
  SnapIndicator,
  SnapResizeInput,
  SnapTarget,
  SnapTranslateResult,
} from "./types"
import type { Rect } from "@/types/document"

export { SNAP_THRESHOLD_SCREEN, thresholdFromZoom }

export interface SnapSessionResult {
  /** 相对 raw dragDelta 额外需要施加的 nudge */
  nudgeX: number
  nudgeY: number
  indicators: SnapIndicator[]
  snappedBounds: Rect
}

/**
 * 每段拖拽一个 Session。
 * tldraw 本身无迟滞锁（阈值内最近者胜）；这里保持同样语义。
 */
export class SnapSession {
  resolveTranslate(args: {
    initialSelectionBounds: Rect
    dragDelta: { x: number; y: number }
    targets: SnapTarget[]
    zoom: number
    lockedAxis?: "x" | "y" | null
  }): SnapSessionResult {
    const result: SnapTranslateResult = snapTranslate({
      initialSelectionBounds: args.initialSelectionBounds,
      dragDelta: args.dragDelta,
      targets: args.targets,
      threshold: thresholdFromZoom(args.zoom),
      lockedAxis: args.lockedAxis ?? null,
    })
    return {
      nudgeX: result.nudge.x,
      nudgeY: result.nudge.y,
      indicators: result.indicators,
      snappedBounds: result.snappedBounds,
    }
  }

  resolveResize(args: {
    initialBounds: Rect
    rawBounds: Rect
    targets: SnapTarget[]
    zoom: number
    edges: SnapResizeInput["edges"]
  }): SnapSessionResult {
    const result = snapResize({
      initialBounds: args.initialBounds,
      rawBounds: args.rawBounds,
      targets: args.targets,
      threshold: thresholdFromZoom(args.zoom),
      edges: args.edges,
    })
    return {
      nudgeX: result.nudge.x,
      nudgeY: result.nudge.y,
      indicators: result.indicators,
      snappedBounds: result.snappedBounds,
    }
  }

  reset(): void {
    // 无状态
  }
}

export function createSnapSession(): SnapSession {
  return new SnapSession()
}

/** 从父容器 + 兄弟 + 画布 组装 targets */
export function buildSnapTargets(args: {
  siblingRects: { id: string; bounds: Rect }[]
  parentRect: Rect
  parentId?: string
  canvasRect: Rect
  canvasId?: string
}): SnapTarget[] {
  const targets: SnapTarget[] = args.siblingRects.map((s) => ({
    id: s.id,
    bounds: s.bounds,
  }))
  targets.push({ id: args.parentId ?? "__parent", bounds: args.parentRect })
  // canvas 与 parent 不同时加入
  const c = args.canvasRect
  const p = args.parentRect
  if (c.x !== p.x || c.y !== p.y || c.w !== p.w || c.h !== p.h) {
    targets.push({ id: args.canvasId ?? "__canvas", bounds: c })
  }
  return targets
}
