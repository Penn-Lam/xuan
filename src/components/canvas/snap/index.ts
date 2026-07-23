// ============================================================
//  snap/ —— 智能吸附公共出口
// ============================================================
export type {
  Axis,
  SnapKind,
  SnapGuide,
  SnapMeasurement,
  SnapCandidate,
  SnapFrameInput,
  SnapFrameResult,
} from "./types"
export { SnapSession, createSnapSession, resolveSnapFrame, generateCandidates } from "./engine"
export { ENTER_SCREEN_PX, EXIT_SCREEN_PX, thresholdDoc } from "./constants"
export { unionRects } from "./geometry"
