// ============================================================
//  snap/resolve —— 候选排序 + 进入/退出迟滞
// ============================================================
import { ENTER_SCREEN_PX, EXIT_SCREEN_PX, thresholdDoc } from "./constants"
import type { Axis, SnapCandidate, SnapFrameResult, SnapGuide, SnapMeasurement } from "./types"
import type { Rect } from "@/types/document"

function compareCandidates(a: SnapCandidate, b: SnapCandidate): number {
  if (a.priority !== b.priority) return a.priority - b.priority
  if (a.error !== b.error) return a.error - b.error
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** 在 enter 阈值内选最佳候选 */
export function pickBest(
  candidates: SnapCandidate[],
  axis: Axis,
  enter: number,
): SnapCandidate | null {
  const pool = candidates
    .filter((c) => c.axis === axis && c.error <= enter)
    .sort(compareCandidates)
  return pool[0] ?? null
}

/**
 * 迟滞：若 lock 仍在 exit 内则保持；否则重新 pick。
 * 返回更新后的 lock（可能 null）。
 */
export function resolveAxis(
  candidates: SnapCandidate[],
  axis: Axis,
  zoom: number,
  prevLock: SnapCandidate | null,
): SnapCandidate | null {
  const enter = thresholdDoc(ENTER_SCREEN_PX, zoom)
  const exit = thresholdDoc(EXIT_SCREEN_PX, zoom)

  if (prevLock && prevLock.axis === axis) {
    // 用同 id 刷新 error/delta（位置随帧变）
    const fresh = candidates.find((c) => c.id === prevLock.id)
    if (fresh && fresh.error <= exit) {
      return fresh
    }
  }

  return pickBest(candidates, axis, enter)
}

export function candidateToGuide(c: SnapCandidate): SnapGuide {
  return {
    orientation: c.axis === "x" ? "v" : "h",
    position: c.guidePos,
    from: c.guideFrom,
    to: c.guideTo,
    kind: c.kind,
  }
}

export function buildResult(
  rawRect: Rect,
  lockX: SnapCandidate | null,
  lockY: SnapCandidate | null,
  mode: "move" | "resize",
): SnapFrameResult {
  let deltaX = lockX?.delta ?? 0
  let deltaY = lockY?.delta ?? 0
  let sizeDelta: SnapFrameResult["sizeDelta"]

  if (mode === "resize") {
    const sdx = lockX?.sizeDelta
    const sdy = lockY?.sizeDelta
    if (sdx || sdy) {
      sizeDelta = {
        dw: (sdx?.dw ?? 0) + (sdy?.dw ?? 0),
        dh: (sdx?.dh ?? 0) + (sdy?.dh ?? 0),
        dx: (sdx?.dx ?? 0) + (sdy?.dx ?? 0),
        dy: (sdx?.dy ?? 0) + (sdy?.dy ?? 0),
      }
      deltaX = sizeDelta.dx
      deltaY = sizeDelta.dy
    } else {
      // 无 sizeDelta 的锁（少见）：退化为平移
      sizeDelta = { dw: 0, dh: 0, dx: deltaX, dy: deltaY }
    }
  }

  const guides: SnapGuide[] = []
  const measurements: SnapMeasurement[] = []
  for (const c of [lockX, lockY]) {
    if (!c) continue
    // grid 通常不画满引导，仍画短线便于感知
    guides.push(candidateToGuide(c))
    if (c.measurement) measurements.push(c.measurement)
  }

  const adjustedRect: Rect =
    mode === "resize" && sizeDelta
      ? {
          x: rawRect.x + sizeDelta.dx,
          y: rawRect.y + sizeDelta.dy,
          w: Math.max(1, rawRect.w + sizeDelta.dw),
          h: Math.max(1, rawRect.h + sizeDelta.dh),
        }
      : {
          x: rawRect.x + deltaX,
          y: rawRect.y + deltaY,
          w: rawRect.w,
          h: rawRect.h,
        }

  return {
    deltaX,
    deltaY,
    sizeDelta,
    guides,
    measurements,
    adjustedRect,
  }
}
