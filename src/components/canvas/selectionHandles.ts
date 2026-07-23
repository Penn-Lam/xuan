// ============================================================
//  selectionHandles —— 选区手柄几何与样式
// ============================================================

export type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

export const RESIZE_HANDLES: ResizeDir[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
]

export function handlePositionClass(dir: ResizeDir): string {
  const map: Record<ResizeDir, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
    n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
    e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
    se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
    s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
    sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
    w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
  }
  return map[dir]
}

export function handleCursor(dir: ResizeDir): string {
  const map: Record<ResizeDir, string> = {
    nw: "nwse-resize",
    n: "ns-resize",
    ne: "nesw-resize",
    e: "ew-resize",
    se: "nwse-resize",
    s: "ns-resize",
    sw: "nesw-resize",
    w: "ew-resize",
  }
  return map[dir]
}

/** Shift 锁轴：返回被锁定（不可动）的轴 */
export function lockedAxisFromDelta(
  dx: number,
  dy: number,
  shiftKey: boolean,
): "x" | "y" | null {
  if (!shiftKey) return null
  return Math.abs(dx) >= Math.abs(dy) ? "y" : "x"
}

/** 应用锁轴后的位移 */
export function applyAxisLock(
  dx: number,
  dy: number,
  locked: "x" | "y" | null,
): { dx: number; dy: number } {
  if (locked === "x") return { dx: 0, dy }
  if (locked === "y") return { dx, dy: 0 }
  return { dx, dy }
}
