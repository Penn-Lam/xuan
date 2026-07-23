// ============================================================
//  useCanvasSnap —— 吸附 UI 状态 + 像素网格工具
//  引擎逻辑在 ./snap/；本文件仅 Zustand feedback 与兼容 re-export
// ============================================================
import { create } from "zustand"
import type { SnapGuide, SnapMeasurement } from "./snap"
export type { SnapGuide, SnapMeasurement } from "./snap"
export {
  createSnapSession,
  resolveSnapFrame,
  unionRects,
  type SnapSession,
  type SnapFrameInput,
  type SnapFrameResult,
} from "./snap"

interface SnapState {
  guides: SnapGuide[]
  measurements: SnapMeasurement[]
  setFeedback: (guides: SnapGuide[], measurements: SnapMeasurement[]) => void
  setGuides: (guides: SnapGuide[]) => void
  clearGuides: () => void
}

export const useSnapStore = create<SnapState>((set) => ({
  guides: [],
  measurements: [],
  setFeedback: (guides, measurements) => set({ guides, measurements }),
  setGuides: (guides) => set({ guides, measurements: [] }),
  clearGuides: () => set({ guides: [], measurements: [] }),
}))

/**
 * 网格吸附（zoom-aware）
 * 网格大小随 zoom 自适应：2^ceil(log2(4/zoom))
 */
export function snapToGrid(value: number, zoom: number): number {
  const gridSize = Math.pow(2, Math.ceil(Math.log2(4 / Math.max(0.05, zoom))))
  return Math.round(value / gridSize) * gridSize
}
