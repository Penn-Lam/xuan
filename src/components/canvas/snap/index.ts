// ============================================================
//  snap/ —— tldraw 风格智能吸附
// ============================================================
export type {
  Vec2,
  PointsSnapIndicator,
  GapsSnapIndicator,
  SnapIndicator,
  SnapTarget,
  SnapGuide,
} from "./types"
export {
  createSnapSession,
  buildSnapTargets,
  thresholdFromZoom,
  type SnapSession,
  type SnapSessionResult,
} from "./engine"
export { snapTranslate, snapResize, collectGaps } from "./boundsSnap"
export { unionRects } from "./geometry"
