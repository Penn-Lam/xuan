// ============================================================
//  snap/engine —— 对外 API：SnapSession
//  每段拖拽一个实例，内含 x/y 迟滞锁
// ============================================================
import {
  collectAlignCandidates,
  paddingCandidates,
  gridCandidates,
  sizeCandidates,
} from "./candidates"
import { spacingCandidates, patternCandidates } from "./spacing"
import { resolveAxis, buildResult } from "./resolve"
import type { SnapCandidate, SnapFrameInput, SnapFrameResult } from "./types"

export function generateCandidates(input: SnapFrameInput): SnapCandidate[] {
  const out: SnapCandidate[] = []
  const self = input.rawRect

  out.push(...collectAlignCandidates(input))

  if (input.mode === "move") {
    out.push(...spacingCandidates(self, input.targets))
    out.push(...patternCandidates(self, input.targets, input.zoom))
    out.push(...paddingCandidates(self, input.parentRect, input.targets))
    out.push(
      ...gridCandidates(
        self,
        input.parentRect,
        input.enableLayoutGrid !== false,
        Boolean(input.enablePixelGrid),
        input.zoom,
      ),
    )
  }

  if (input.mode === "resize" && input.resizeEdges) {
    out.push(...sizeCandidates(self, input.targets, input.resizeEdges))
    // resize 也可吸父边（通过对齐）与同高宽已覆盖
    out.push(...paddingCandidates(self, input.parentRect, input.targets))
  }

  return out
}

export class SnapSession {
  private lockX: SnapCandidate | null = null
  private lockY: SnapCandidate | null = null

  resolve(input: SnapFrameInput): SnapFrameResult {
    const candidates = generateCandidates(input)
    this.lockX = resolveAxis(candidates, "x", input.zoom, this.lockX)
    this.lockY = resolveAxis(candidates, "y", input.zoom, this.lockY)
    return buildResult(input.rawRect, this.lockX, this.lockY, input.mode)
  }

  reset(): void {
    this.lockX = null
    this.lockY = null
  }
}

export function createSnapSession(): SnapSession {
  return new SnapSession()
}

/** 无状态单帧 resolve（无迟滞，测试用） */
export function resolveSnapFrame(input: SnapFrameInput): SnapFrameResult {
  return new SnapSession().resolve(input)
}
