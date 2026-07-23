// ============================================================
//  snap/constants —— 优先级、阈值、预设
// ============================================================
import type { SnapKind, SnapTargetSource } from "./types"

/** 屏幕像素：进入吸附 */
export const ENTER_SCREEN_PX = 6
/** 屏幕像素：退出吸附（> enter，形成迟滞） */
export const EXIT_SCREEN_PX = 12

/** 默认父内边距候选（document 单位） */
export const DEFAULT_PADDINGS = [8, 12, 16, 24, 32] as const

/** 父布局网格步长 */
export const LAYOUT_GRID_STEP = 8

/** 邻居投影重叠比例（判定同行/列相邻） */
export const OVERLAP_RATIO = 0.3

/** 行/列中心对齐容差（document，再 / zoom 缩放） */
export const ROW_COL_CENTER_TOLERANCE = 8

/** pattern / grid 最多向外延伸步数 */
export const PATTERN_MAX_STEPS = 2

/** 优先级：越小越优先 */
export const PRIORITY: Record<
  SnapKind | `${"edge" | "center"}:${SnapTargetSource}`,
  number
> = {
  "edge:sibling": 10,
  "center:sibling": 20,
  "edge:parent": 30,
  "edge:canvas": 35,
  "center:parent": 40,
  "center:canvas": 45,
  edge: 30,
  center: 40,
  spacing: 50,
  pattern: 55,
  size: 60,
  padding: 70,
  grid: 90,
}

export function priorityFor(
  kind: SnapKind,
  source?: SnapTargetSource,
): number {
  if ((kind === "edge" || kind === "center") && source) {
    return PRIORITY[`${kind}:${source}`]
  }
  return PRIORITY[kind]
}

/** screen px → document 单位 */
export function thresholdDoc(screenPx: number, zoom: number): number {
  const z = Math.max(0.05, zoom)
  return screenPx / z
}
