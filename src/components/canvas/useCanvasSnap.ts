// ============================================================
//  useCanvasSnap —— 吸附 UI 状态（indicators）
//  引擎：./snap（移植 tldraw BoundsSnaps）
// ============================================================
import { create } from "zustand"
import type { SnapIndicator } from "./snap"

export type { SnapIndicator, SnapGuide, PointsSnapIndicator, GapsSnapIndicator } from "./snap"
export {
  createSnapSession,
  buildSnapTargets,
  unionRects,
  thresholdFromZoom,
  SNAP_THRESHOLD_SCREEN,
  type SnapSession,
  type SnapSessionResult,
  type SnapTarget,
} from "./snap"

interface SnapState {
  indicators: SnapIndicator[]
  setIndicators: (indicators: SnapIndicator[]) => void
  /** @deprecated 兼容旧 API */
  setFeedback: (guides: SnapIndicator[], _measurements?: unknown[]) => void
  setGuides: (guides: SnapIndicator[]) => void
  clearGuides: () => void
  /** @deprecated */
  guides: SnapIndicator[]
  measurements: never[]
}

export const useSnapStore = create<SnapState>((set) => ({
  indicators: [],
  guides: [],
  measurements: [],
  setIndicators: (indicators) => set({ indicators, guides: indicators }),
  setFeedback: (guides) => set({ indicators: guides, guides }),
  setGuides: (guides) => set({ indicators: guides, guides }),
  clearGuides: () => set({ indicators: [], guides: [], measurements: [] }),
}))

export function snapToGrid(value: number, zoom: number): number {
  const gridSize = Math.pow(2, Math.ceil(Math.log2(4 / Math.max(0.05, zoom))))
  return Math.round(value / gridSize) * gridSize
}
