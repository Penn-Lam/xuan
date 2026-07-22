// ============================================================
//  useCanvasSnap —— Canvas 智能吸附 + 网格吸附
//  拖拽时计算兄弟节点边缘/中心对齐，显示红色辅助线
//  纯 UI 状态（guides），不写入 document store
// ============================================================
import { create } from "zustand"
import type { Rect } from "@/types/document"

/** 辅助线（红色引导线） */
export interface SnapGuide {
  orientation: "h" | "v" // h=水平线, v=垂直线
  position: number // 线的位置（绝对坐标）
}

interface SnapState {
  guides: SnapGuide[]
  setGuides: (guides: SnapGuide[]) => void
  clearGuides: () => void
}

export const useSnapStore = create<SnapState>((set) => ({
  guides: [],
  setGuides: (guides) => set({ guides }),
  clearGuides: () => set({ guides: [] }),
}))

const SNAP_THRESHOLD = 5 // 吸附阈值（像素）

/**
 * 计算拖拽节点应该吸附到的位置
 * 对齐目标：父容器 + 所有兄弟节点的 左/中/右 & 上/中/下
 * @param dragRect 当前拖拽节点 rect（绝对坐标）
 * @param siblings 兄弟节点 rects（绝对坐标，排除自身）
 * @param parentRect 父容器 rect（绝对坐标）
 * @returns { adjustedRect, guides }
 */
export function computeSnap(
  dragRect: Rect,
  siblings: Rect[],
  parentRect: Rect,
): { adjustedRect: Rect; guides: SnapGuide[] } {
  const guides: SnapGuide[] = []
  let { x, y, w, h } = dragRect

  // 节点的关键线（左/中/右，上/中/下）
  const selfXs = [x, x + w / 2, x + w]
  const selfYs = [y, y + h / 2, y + h]

  // 收集所有目标线（父容器 + 兄弟）
  const targetXs: number[] = [parentRect.x, parentRect.x + parentRect.w / 2, parentRect.x + parentRect.w]
  const targetYs: number[] = [parentRect.y, parentRect.y + parentRect.h / 2, parentRect.y + parentRect.h]
  for (const s of siblings) {
    targetXs.push(s.x, s.x + s.w / 2, s.x + s.w)
    targetYs.push(s.y, s.y + s.h / 2, s.y + s.h)
  }

  // 垂直吸附（x 轴对齐 → 画垂直辅助线 v）
  let bestDX = SNAP_THRESHOLD + 1
  let snapOffsetX = 0
  let snapGuideX: number | null = null
  for (let i = 0; i < 3; i++) {
    for (const tx of targetXs) {
      const dx = selfXs[i] - tx
      if (Math.abs(dx) < bestDX) {
        bestDX = Math.abs(dx)
        snapOffsetX = -dx
        snapGuideX = tx
      }
    }
  }
  if (bestDX <= SNAP_THRESHOLD) {
    x += snapOffsetX
    if (snapGuideX !== null) guides.push({ orientation: "v", position: snapGuideX })
  }

  // 水平吸附（y 轴对齐 → 画水平辅助线 h）
  let bestDY = SNAP_THRESHOLD + 1
  let snapOffsetY = 0
  let snapGuideY: number | null = null
  for (let i = 0; i < 3; i++) {
    for (const ty of targetYs) {
      const dy = selfYs[i] - ty
      if (Math.abs(dy) < bestDY) {
        bestDY = Math.abs(dy)
        snapOffsetY = -dy
        snapGuideY = ty
      }
    }
  }
  if (bestDY <= SNAP_THRESHOLD) {
    y += snapOffsetY
    if (snapGuideY !== null) guides.push({ orientation: "h", position: snapGuideY })
  }

  return { adjustedRect: { x, y, w, h }, guides }
}

/**
 * 网格吸附（zoom-aware）
 * 网格大小随 zoom 自适应：2^ceil(log2(4/zoom))
 */
export function snapToGrid(value: number, zoom: number): number {
  const gridSize = Math.pow(2, Math.ceil(Math.log2(4 / zoom)))
  return Math.round(value / gridSize) * gridSize
}
